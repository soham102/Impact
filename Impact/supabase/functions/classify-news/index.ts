// classify-news — tag articles with category, topics, industries and locations.
//
// Pipeline stage 2 of 3:  fetch-news → classify-news → generate-impact
//
// With AI_API_KEY set, Claude classifies headlines in batches against a fixed
// vocabulary (taxonomy.ts). Without it, the deterministic keyword classifier
// in taxonomy.ts is used and the response reports `method: "rules"`.
//
// Body: { article_ids?: string[], limit?: number, analyze?: boolean }
// Without article_ids, recent articles that have no article_topics rows are classified.

import { adminClient, getCaller, invokeFunction, selectIn } from "../_shared/admin.ts";
import { AI_MODEL, aiConfigured, generateJson } from "../_shared/ai.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { CATEGORIES, classifyText, INDUSTRY_NAMES, LOCATIONS, TOPIC_NAMES } from "../_shared/taxonomy.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

type Row = Record<string, unknown>;
interface Article {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
}
interface Classification {
  category: string | null;
  topics: string[];
  industries: string[];
  locations: string[];
}

const AI_BATCH = 20;
const LOCATION_NAMES = LOCATIONS.map((l) => l.name);

const SYSTEM = `You classify news headlines for a personal news-intelligence product.
Use only the allowed values given in the schema. Classify strictly from what the headline and summary state; do not infer facts that are not there.
- category: the single best section for the story.
- topics: 1–4 topics the story is actually about (not tangential mentions).
- industries: 0–3 industries directly affected.
- locations: places the story concerns (cities, states, countries). Use "India" for national Indian stories.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["articles"],
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "category", "topics", "industries", "locations"],
        properties: {
          index: { type: "integer" },
          category: { type: "string", enum: [...CATEGORIES] },
          topics: { type: "array", items: { type: "string", enum: TOPIC_NAMES } },
          industries: { type: "array", items: { type: "string", enum: INDUSTRY_NAMES } },
          locations: { type: "array", items: { type: "string", enum: LOCATION_NAMES } },
        },
      },
    },
  },
};

async function classifyWithAi(articles: Article[]): Promise<Map<string, Classification>> {
  const out = new Map<string, Classification>();
  for (let i = 0; i < articles.length; i += AI_BATCH) {
    const batch = articles.slice(i, i + AI_BATCH);
    const list = batch
      .map((a, idx) => `[${idx}] ${a.title}${a.summary ? `\n    ${a.summary}` : ""}`)
      .join("\n");
    const res = await generateJson<{ articles: (Classification & { index: number })[] }>({
      system: SYSTEM,
      prompt: `Classify each of these ${batch.length} articles. Return one entry per index.\n\n${list}`,
      schema: SCHEMA,
      effort: "low",
    });
    // Keep only values from the fixed vocabulary; not every model enforces the schema.
    const only = (vals: unknown, allowed: readonly string[], max: number) =>
      (Array.isArray(vals) ? vals : []).map(String).filter((v) => allowed.includes(v)).slice(0, max);
    for (const c of res.articles ?? []) {
      const a = batch[Number(c.index)];
      if (!a) continue;
      out.set(a.id, {
        category: (CATEGORIES as readonly string[]).includes(c.category ?? "") ? c.category : null,
        topics: only(c.topics, TOPIC_NAMES, 4),
        industries: only(c.industries, INDUSTRY_NAMES, 3),
        locations: only(c.locations, LOCATION_NAMES, 4),
      });
    }
  }
  return out;
}

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
  if (!caller || caller.kind !== "service") return json({ error: "classify-news can only be run by the server pipeline." }, 403);

  const body = (await req.json().catch(() => ({}))) as { article_ids?: string[]; limit?: number; analyze?: boolean };

  // 1. Load target articles
  let articles: Article[] = [];
  if (body.article_ids?.length) {
    const { data, error } = await selectIn<Article>(admin, "news_articles", "id,title,summary,category", "id", body.article_ids);
    if (error) return json({ error }, 500);
    articles = data;
  } else {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data, error } = await admin
      .from("news_articles")
      .select("id,title,summary,category,article_topics(topic_id)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(Math.min(body.limit ?? 200, 500));
    if (error) return json({ error: error.message }, 500);
    articles = ((data ?? []) as (Article & { article_topics: unknown[] })[])
      .filter((a) => !a.article_topics?.length)
      .map(({ id, title, summary, category }) => ({ id, title, summary, category }));
  }
  if (articles.length === 0) return json({ classified: 0, message: "Nothing to classify." });

  // 2. Classify
  let method: "ai" | "rules" = "rules";
  let results = new Map<string, Classification>();
  let aiError: string | null = null;
  if (aiConfigured()) {
    try {
      results = await classifyWithAi(articles);
      method = "ai";
    } catch (e) {
      aiError = (e as Error).message;
      console.error("AI classification failed, falling back to rules:", aiError);
    }
  }
  for (const a of articles) {
    if (!results.has(a.id)) results.set(a.id, classifyText(`${a.title} ${a.summary ?? ""}`));
  }

  // 3. Make sure every topic name used exists in `topics`
  const usedTopics = new Set<string>();
  results.forEach((c) => c.topics.forEach((t) => usedTopics.add(t)));
  const { data: topicRows, error: tErr } = await admin.from("topics").select("id,name");
  if (tErr) return json({ error: `Reading topics failed: ${tErr.message}` }, 500);
  const topicId = new Map<string, string>((topicRows ?? []).map((t: Row) => [String(t.name), String(t.id)]));
  const missing = [...usedTopics].filter((t) => !topicId.has(t));
  if (missing.length) {
    const { data: created, error } = await admin.from("topics").insert(missing.map((name) => ({ name }))).select("id,name");
    if (error) return json({ error: `Creating topics failed: ${error.message}` }, 500);
    (created ?? []).forEach((t: Row) => topicId.set(String(t.name), String(t.id)));
  }

  // 4. Write relationships, skipping pairs that already exist (never delete)
  const ids = articles.map((a) => a.id);
  const [et, el, ei] = await Promise.all([
    selectIn(admin, "article_topics", "article_id,topic_id", "article_id", ids),
    selectIn(admin, "article_locations", "article_id,location", "article_id", ids),
    selectIn(admin, "article_industries", "article_id,industry", "article_id", ids),
  ]);
  const has = new Set<string>([
    ...et.data.map((r: Row) => `t|${r.article_id}|${r.topic_id}`),
    ...el.data.map((r: Row) => `l|${r.article_id}|${r.location}`),
    ...ei.data.map((r: Row) => `i|${r.article_id}|${r.industry}`),
  ]);

  const topicLinks: Row[] = [];
  const locationLinks: Row[] = [];
  const industryLinks: Row[] = [];
  const errors: string[] = [];
  for (const a of articles) {
    const c = results.get(a.id)!;
    for (const t of c.topics) {
      const tid = topicId.get(t);
      if (tid && !has.has(`t|${a.id}|${tid}`)) topicLinks.push({ article_id: a.id, topic_id: tid });
    }
    for (const l of c.locations) if (!has.has(`l|${a.id}|${l}`)) locationLinks.push({ article_id: a.id, location: l });
    for (const i of c.industries) if (!has.has(`i|${a.id}|${i}`)) industryLinks.push({ article_id: a.id, industry: i });
    if (c.category && c.category !== a.category) {
      const { error } = await admin.from("news_articles").update({ category: c.category }).eq("id", a.id);
      if (error) errors.push(`category ${a.id}: ${error.message}`);
    }
  }
  for (const [table, rows] of [["article_topics", topicLinks], ["article_locations", locationLinks], ["article_industries", industryLinks]] as const) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.from(table).insert(rows.slice(i, i + 200));
      if (error) errors.push(`${table}: ${error.message}`);
    }
  }

  const summary = {
    classified: articles.length,
    method,
    ai_model: method === "ai" ? AI_MODEL : null,
    ai_error: aiError,
    ai_configured: aiConfigured(),
    topics_linked: topicLinks.length,
    locations_linked: locationLinks.length,
    industries_linked: industryLinks.length,
    errors,
  };
  console.log("classify-news", JSON.stringify(summary));

  // Stage 3: targeted impact analysis for users these articles are relevant to.
  if (body.analyze !== false) {
    const next = invokeFunction("generate-impact", { article_ids: ids }).catch((e) =>
      console.error("generate-impact invocation failed", e),
    );
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(next);
    else await next;
  }

  return json(summary, errors.length && !topicLinks.length ? 500 : 200);
});
