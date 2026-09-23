// fetch-news — ingest real Google News RSS results into news_articles.
//
// Pipeline stage 1 of 3:  fetch-news → classify-news → generate-impact
//
// Invocation:
//   • Scheduler (pg_cron / external cron) with the service-role key or CRON_SECRET.
//   • A signed-in user ("Refresh" in the app). Throttled so users can't hammer Google.
//
// Queries come from the `news_queries` table when it exists; otherwise from
// DEFAULT_NEWS_QUERIES. Runs are recorded in `news_ingestion_logs` when that
// table exists; the same summary is always returned in the response body.

import { adminClient, getCaller, invokeFunction } from "../_shared/admin.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { googleNewsSearchUrl, parseGoogleNewsRss, type RssItem } from "../_shared/rss.ts";
import { DEFAULT_NEWS_QUERIES } from "../_shared/taxonomy.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const MAX_ITEMS_PER_QUERY = 25;
const USER_REFRESH_COOLDOWN_MIN = 20;
const FETCH_TIMEOUT_MS = 15_000;

interface NewsQuery {
  query: string;
  category: string | null;
  hl?: string;
  gl?: string;
  ceid?: string;
}

type Row = Record<string, unknown>;

async function loadQueries(admin: ReturnType<typeof adminClient>): Promise<{ queries: NewsQuery[]; source: string }> {
  const { data, error } = await admin.from("news_queries").select("*");
  if (error || !data) {
    return { queries: DEFAULT_NEWS_QUERIES.map((q) => ({ ...q })), source: "defaults (news_queries table not available)" };
  }
  const queries = (data as Row[])
    .filter((r) => (r.is_active ?? r.active ?? true) !== false)
    .map((r) => ({
      query: String(r.query ?? r.query_text ?? r.search_query ?? r.name ?? "").trim(),
      category: (r.category as string) ?? null,
      hl: (r.hl as string) ?? undefined,
      gl: (r.gl as string) ?? undefined,
      ceid: (r.ceid as string) ?? undefined,
    }))
    .filter((q) => q.query.length > 0);
  if (queries.length === 0) {
    return { queries: DEFAULT_NEWS_QUERIES.map((q) => ({ ...q })), source: "defaults (news_queries has no active rows)" };
  }
  return { queries, source: "news_queries" };
}

async function fetchFeed(q: NewsQuery): Promise<RssItem[]> {
  const url = googleNewsSearchUrl(q.query, { hl: q.hl, gl: q.gl, ceid: q.ceid, window: "7d" });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; ImpactNewsBot/1.0)" } });
    if (!res.ok) throw new Error(`Google News returned ${res.status} for "${q.query}"`);
    return parseGoogleNewsRss(await res.text()).slice(0, MAX_ITEMS_PER_QUERY);
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = { status: "fulfilled", value: await fn(items[idx]) };
      } catch (reason) {
        out[idx] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let admin;
  try {
    admin = adminClient();
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  const caller = await getCaller(req, admin);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const body = (await req.json().catch(() => ({}))) as { classify?: boolean };

  // Users may trigger a refresh, but not more than once per cooldown window (globally).
  if (caller.kind === "user") {
    const { data: latest } = await admin
      .from("news_articles")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = latest?.created_at ? new Date(latest.created_at as string).getTime() : 0;
    if (Date.now() - last < USER_REFRESH_COOLDOWN_MIN * 60_000) {
      return json({ skipped: true, reason: `News was refreshed less than ${USER_REFRESH_COOLDOWN_MIN} minutes ago.` });
    }
  }

  const startedAt = new Date().toISOString();
  let logId: string | null = null;
  {
    const { data, error } = await admin
      .from("news_ingestion_logs")
      .insert({ status: "running", started_at: startedAt })
      .select("id")
      .single();
    if (!error && data) logId = (data as Row).id as string;
  }

  const errors: string[] = [];
  let articlesFound = 0;
  let articlesInserted = 0;
  let insertedIds: string[] = [];
  let querySource = "";

  try {
    const { queries, source } = await loadQueries(admin);
    querySource = source;

    const results = await mapLimit(queries, 4, fetchFeed);
    const byLink = new Map<string, RssItem & { category: string | null }>();
    const seenTitles = new Set<string>();
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        errors.push(String((r.reason as Error)?.message ?? r.reason));
        return;
      }
      for (const item of r.value) {
        const nt = normTitle(item.title);
        if (byLink.has(item.link) || seenTitles.has(nt)) continue;
        seenTitles.add(nt);
        byLink.set(item.link, { ...item, category: queries[idx].category });
      }
    });
    const items = [...byLink.values()];
    articlesFound = items.length;

    // news_articles has no guid column; the Google News article link embeds the
    // guid, so source_url is used as the de-duplication key (plus exact title).
    const existingLinks = new Set<string>();
    const existingTitles = new Set<string>();
    // Google News links are ~250 chars, so keep `in (...)` filters short enough for the URL.
    for (const part of chunk(items, 20)) {
      const { data, error } = await admin.from("news_articles").select("source_url").in("source_url", part.map((i) => i.link));
      if (error) throw new Error(`Checking duplicates failed: ${error.message}`);
      (data ?? []).forEach((d: Row) => existingLinks.add(d.source_url as string));
      const { data: tData } = await admin.from("news_articles").select("title").in("title", part.map((i) => i.title));
      (tData ?? []).forEach((d: Row) => existingTitles.add(normTitle(d.title as string)));
    }
    const fresh = items.filter((i) => !existingLinks.has(i.link) && !existingTitles.has(normTitle(i.title)));

    for (const part of chunk(fresh, 50)) {
      const rows = part.map((i) => ({
        title: i.title,
        summary: i.description,
        source_name: i.source,
        source_url: i.link,
        category: i.category,
        published_at: i.publishedAt,
      }));
      const { data, error } = await admin.from("news_articles").insert(rows).select("id");
      if (error) {
        // Fall back to row-by-row so one bad row (e.g. a race on a unique key) doesn't drop the batch.
        for (const row of rows) {
          const { data: one, error: e1 } = await admin.from("news_articles").insert(row).select("id").single();
          if (!e1 && one) insertedIds.push((one as Row).id as string);
          else if (e1 && e1.code !== "23505") errors.push(`Insert failed: ${e1.message}`);
        }
      } else {
        insertedIds = insertedIds.concat((data ?? []).map((d: Row) => d.id as string));
      }
    }
    articlesInserted = insertedIds.length;
  } catch (e) {
    errors.push((e as Error).message);
  }

  const status = errors.length === 0 ? "success" : articlesInserted > 0 || articlesFound > 0 ? "partial" : "failed";
  const summary = {
    status,
    query_source: querySource,
    articles_found: articlesFound,
    articles_inserted: articlesInserted,
    error_message: errors.length ? errors.slice(0, 10).join(" | ") : null,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    logged: logId !== null,
  };

  if (logId) {
    await admin
      .from("news_ingestion_logs")
      .update({
        status,
        articles_found: articlesFound,
        articles_inserted: articlesInserted,
        error_message: summary.error_message,
        completed_at: summary.completed_at,
      })
      .eq("id", logId);
  }
  console.log("fetch-news", JSON.stringify(summary));

  // Stage 2: classify the new articles (which in turn triggers targeted impact analysis).
  if (insertedIds.length > 0 && body.classify !== false) {
    const next = Promise.all([
      invokeFunction("classify-news", { article_ids: insertedIds }).catch((e) => console.error("classify-news invocation failed", e)),
      // Photos + publisher descriptions (Google News RSS has neither).
      invokeFunction("enrich-articles", { article_ids: insertedIds, limit: 120 }).catch((e) =>
        console.error("enrich-articles invocation failed", e),
      ),
    ]);
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(next);
    else await next;
  }

  return json(summary, status === "failed" ? 502 : 200);
});
