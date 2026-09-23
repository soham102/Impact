// enrich-articles — add a real photo (og:image) and the publisher's own
// description to articles ingested from Google News RSS, which has neither.
//
// Runs after fetch-news for new articles, and can be called by a signed-in
// user to backfill recent articles that have not been enriched yet.
//
// Body: { article_ids?: string[], limit?: number }
// image_url is set to "" when no image could be found, so an article is only tried once.

import { adminClient, getCaller, selectIn } from "../_shared/admin.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { fetchPageMeta, resolveGoogleNewsUrl } from "../_shared/enrich.ts";

type Row = { id: string; source_url: string | null; summary: string | null; image_url: string | null };

const USER_LIMIT = 40;
const SERVICE_LIMIT = 120;
const CONCURRENCY = 6;

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
  const body = (await req.json().catch(() => ({}))) as { article_ids?: string[]; limit?: number };
  const max = Math.min(body.limit ?? USER_LIMIT, caller.kind === "service" ? SERVICE_LIMIT : USER_LIMIT);

  let rows: Row[];
  if (body.article_ids?.length && caller.kind === "service") {
    const { data, error } = await selectIn<Row>(admin, "news_articles", "id,source_url,summary,image_url", "id", body.article_ids);
    if (error) return json({ error }, 500);
    rows = data.filter((r) => r.image_url === null).slice(0, max);
  } else {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data, error } = await admin
      .from("news_articles")
      .select("id,source_url,summary,image_url")
      .is("image_url", null)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(max);
    if (error) return json({ error: error.message }, 500);
    rows = (data ?? []) as Row[];
  }
  if (!rows.length) return json({ processed: 0, images: 0, remaining: 0 });

  let images = 0;
  let summaries = 0;
  let failed = 0;
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const row = rows[i++];
      let image: string | null = null;
      let description: string | null = null;
      try {
        const target = row.source_url ? await resolveGoogleNewsUrl(row.source_url) : null;
        const meta = target ? await fetchPageMeta(target) : null;
        image = meta?.image ?? null;
        description = meta?.description ?? null;
      } catch {
        failed++;
      }
      const update: Record<string, string> = { image_url: image ?? "" };
      if (!row.summary && description) update.summary = description;
      const { error } = await admin.from("news_articles").update(update).eq("id", row.id);
      if (!error) {
        if (image) images++;
        if (update.summary) summaries++;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const { count } = await admin.from("news_articles").select("id", { count: "exact", head: true }).is("image_url", null);
  const summary = { processed: rows.length, images, summaries, failed, remaining: count ?? null };
  console.log("enrich-articles", JSON.stringify(summary));
  return json(summary);
});
