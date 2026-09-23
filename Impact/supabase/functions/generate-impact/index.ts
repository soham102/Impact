// generate-impact — personalised impact analysis, only where it is warranted.
//
// Pipeline stage 3 of 3:  fetch-news → classify-news → generate-impact
//
// Cost control: we never analyse every article × every user. For each article
// the transparent relevance model (relevance.ts) scores every profile using
// classification metadata; only users at "medium" relevance or higher become
// candidates, capped per article and per run. Candidates for one article are
// analysed together in a single model call.
//
// Modes
//   service  { article_ids: string[] }   → candidates across all users (pipeline)
//   user     { article_id: string }      → on-demand analysis for the caller only
//   user     { mode: "backfill" }        → the caller's most relevant recent
//                                          articles without analysis (after onboarding)

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { adminClient, getCaller, selectIn } from "../_shared/admin.ts";
import { AI_MODEL, aiConfigured, AiRefusalError, generateJson } from "../_shared/ai.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { computeRelevance, SCORE_THRESHOLDS, type RelevanceProfile } from "../_shared/relevance.ts";

type Row = Record<string, unknown>;

const MAX_USERS_PER_ARTICLE = 25;
const MAX_ANALYSES_PER_RUN = 60;
const USERS_PER_CALL = 8;
const BACKFILL_ARTICLES = 6;

interface Article {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  source_name: string | null;
  published_at: string | null;
  topics: string[];
  industries: string[];
  locations: string[];
}

interface Profile extends RelevanceProfile {
  id: string;
  age_group: string | null;
}

const ARTICLE_SELECT =
  "id,title,summary,category,source_name,published_at,article_topics(topics(name)),article_locations(location),article_industries(industry)";

function toArticle(r: Row): Article {
  const topics = ((r.article_topics as Row[]) ?? []).map((t) => (t.topics as Row | null)?.name as string).filter(Boolean);
  return {
    id: r.id as string,
    title: r.title as string,
    summary: (r.summary as string) ?? null,
    category: (r.category as string) ?? null,
    source_name: (r.source_name as string) ?? null,
    published_at: (r.published_at as string) ?? null,
    topics,
    locations: ((r.article_locations as Row[]) ?? []).map((l) => l.location as string),
    industries: ((r.article_industries as Row[]) ?? []).map((i) => i.industry as string),
  };
}

async function loadProfiles(admin: SupabaseClient, userIds?: string[]): Promise<Profile[]> {
  let q = admin
    .from("profiles")
    .select(
      "id,age_group,role,industry,location,user_interests(interests(name)),user_goals(goals(name)),user_impact_areas(impact_areas(name))",
    );
  if (userIds) q = q.in("id", userIds);
  const { data, error } = await q;
  if (error) throw new Error(`Loading profiles failed: ${error.message}`);
  const names = (rows: unknown, key: string) =>
    ((rows as Row[]) ?? []).map((r) => (r[key] as Row | null)?.name as string).filter(Boolean);
  return ((data ?? []) as Row[])
    .map((p) => ({
      id: p.id as string,
      age_group: (p.age_group as string) ?? null,
      role: (p.role as string) ?? null,
      industry: (p.industry as string) ?? null,
      location: (p.location as string) ?? null,
      interests: names(p.user_interests, "interests"),
      goals: names(p.user_goals, "goals"),
      impactAreas: names(p.user_impact_areas, "impact_areas"),
    }))
    .filter((p) => p.role || p.industry || p.interests.length); // skip unfinished onboarding
}

const SYSTEM = `You write personalised news-impact notes for "Impact", a personal news-intelligence product.
You receive one news item (headline, optional summary, source) and several anonymous reader profiles.
For each profile, explain what the development could mean for that reader.

Rules — these matter more than anything else:
- Only the headline/summary are facts. Everything you add is a potential implication and must be phrased with hedged language: "could", "may", "might", "potential", "worth watching". Never state predictions as fact.
- Do not invent numbers, quotes, names, dates or details that are not in the article text.
- Be specific to the reader's role, industry, location, interests and goals, but do not overreach. If the story has little bearing on an area, return an empty string for that area.
- why_it_matters: 1–2 sentences on the broader significance (not personalised).
- career_impact / finance_impact / industry_impact / location_impact: 1–2 sentences each, or "" when not meaningfully relevant.
- what_to_watch: 2–4 short, concrete signals to follow next (e.g. "Whether the RBI revises its guidance at the next policy meeting").
- relevance_score: 0–100, how much this story plausibly matters to this reader. is_relevant: false if it has no meaningful bearing on them.
- Plain, calm, precise language. No hype, no emojis.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["analyses"],
  properties: {
    analyses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "profile_index",
          "is_relevant",
          "relevance_score",
          "why_it_matters",
          "career_impact",
          "finance_impact",
          "industry_impact",
          "location_impact",
          "what_to_watch",
        ],
        properties: {
          profile_index: { type: "integer" },
          is_relevant: { type: "boolean" },
          relevance_score: { type: "integer" },
          why_it_matters: { type: "string" },
          career_impact: { type: "string" },
          finance_impact: { type: "string" },
          industry_impact: { type: "string" },
          location_impact: { type: "string" },
          what_to_watch: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

interface Analysis {
  profile_index: number;
  is_relevant: boolean;
  relevance_score: number;
  why_it_matters: string;
  career_impact: string;
  finance_impact: string;
  industry_impact: string;
  location_impact: string;
  what_to_watch: string[];
}

function describeProfile(p: Profile, i: number): string {
  const parts = [
    `[${i}]`,
    p.role && `role: ${p.role}`,
    p.industry && `industry: ${p.industry}`,
    p.location && `location: ${p.location}`,
    p.age_group && `age group: ${p.age_group}`,
    p.interests.length && `interests: ${p.interests.join(", ")}`,
    p.goals.length && `goals: ${p.goals.join(", ")}`,
    p.impactAreas.length && `wants to understand impact on: ${p.impactAreas.join(", ")}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

const orNull = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : null);

async function analyse(admin: SupabaseClient, article: Article, profiles: Profile[], storeIrrelevant: boolean) {
  const rows: Row[] = [];
  for (let i = 0; i < profiles.length; i += USERS_PER_CALL) {
    const group = profiles.slice(i, i + USERS_PER_CALL);
    const prompt = [
      `NEWS ITEM`,
      `Headline: ${article.title}`,
      article.summary ? `Summary: ${article.summary}` : `Summary: (none — only the headline is available)`,
      `Source: ${article.source_name ?? "unknown"}${article.published_at ? ` · published ${article.published_at}` : ""}`,
      article.topics.length ? `Topics: ${article.topics.join(", ")}` : "",
      "",
      `READER PROFILES (${group.length})`,
      ...group.map(describeProfile),
      "",
      `Return exactly one analysis per profile_index.`,
    ].join("\n");
    const res = await generateJson<{ analyses: Analysis[] }>({ system: SYSTEM, prompt, schema: SCHEMA, effort: "medium" });
    const analyses = res.analyses ?? [];
    for (const [pos, a] of analyses.entries()) {
      // Fall back to position when a model omits or mangles profile_index.
      const p = group[Number(a.profile_index)] ?? (analyses.length === group.length ? group[pos] : undefined);
      if (!p) continue;
      if (a.is_relevant === false && !storeIrrelevant) continue;
      const score = Number(a.relevance_score);
      rows.push({
        user_id: p.id,
        article_id: article.id,
        relevance_score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score <= 1 ? score * 100 : score))) : 50,
        why_it_matters: orNull(a.why_it_matters),
        career_impact: orNull(a.career_impact),
        finance_impact: orNull(a.finance_impact),
        industry_impact: orNull(a.industry_impact),
        location_impact: orNull(a.location_impact),
        what_to_watch: (Array.isArray(a.what_to_watch) ? a.what_to_watch : [])
          .map((w) => String(w).trim())
          .filter(Boolean)
          .slice(0, 5),
      });
    }
  }
  if (rows.length) {
    const { error } = await admin.from("impact_analysis").insert(rows);
    if (error) throw new Error(`Saving analysis failed: ${error.message}`);
  }
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let admin: SupabaseClient;
  try {
    admin = adminClient();
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
  const caller = await getCaller(req, admin);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const body = (await req.json().catch(() => ({}))) as { article_ids?: string[]; article_id?: string; mode?: string };

  try {
    // ---------- Build the (article → candidate users) plan ----------
    const plan: { article: Article; profiles: Profile[] }[] = [];
    let storeIrrelevant = false;
    let candidatesConsidered = 0;

    if (caller.kind === "service") {
      if (!body.article_ids?.length) return json({ error: "article_ids is required" }, 400);
      const { data, error } = await selectIn<Row>(admin, "news_articles", ARTICLE_SELECT, "id", body.article_ids.slice(0, 200));
      if (error) throw new Error(error);
      const articles = data.map(toArticle);
      const profiles = await loadProfiles(admin);
      const { data: existing } = await selectIn<Row>(admin, "impact_analysis", "user_id,article_id", "article_id", articles.map((a) => a.id));
      const done = new Set(existing.map((e) => `${e.user_id}|${e.article_id}`));

      let budget = MAX_ANALYSES_PER_RUN;
      const scored = articles.map((article) => {
        const candidates = profiles
          .filter((p) => !done.has(`${p.id}|${article.id}`))
          .map((p) => ({ p, r: computeRelevance(p, article) }))
          .filter((x) => x.r.score >= SCORE_THRESHOLDS.medium)
          .sort((a, b) => b.r.score - a.r.score)
          .slice(0, MAX_USERS_PER_ARTICLE);
        return { article, candidates, top: candidates[0]?.r.score ?? 0 };
      });
      scored.sort((a, b) => b.top - a.top);
      for (const s of scored) {
        candidatesConsidered += s.candidates.length;
        if (budget <= 0 || s.candidates.length === 0) continue;
        const chosen = s.candidates.slice(0, budget).map((c) => c.p);
        budget -= chosen.length;
        plan.push({ article: s.article, profiles: chosen });
      }
    } else {
      storeIrrelevant = true; // the user explicitly asked
      const [profile] = await loadProfiles(admin, [caller.userId]);
      if (!profile) return json({ error: "Complete your Impact Profile first." }, 400);

      if (body.article_id) {
        const { data: existing } = await admin
          .from("impact_analysis")
          .select("id")
          .eq("user_id", caller.userId)
          .eq("article_id", body.article_id)
          .limit(1);
        if (existing?.length) return json({ generated: 0, message: "Analysis already exists." });
        const { data, error } = await admin.from("news_articles").select(ARTICLE_SELECT).eq("id", body.article_id).single();
        if (error || !data) return json({ error: "Article not found" }, 404);
        plan.push({ article: toArticle(data as Row), profiles: [profile] });
        candidatesConsidered = 1;
      } else if (body.mode === "backfill") {
        const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
        const { data, error } = await admin
          .from("news_articles")
          .select(ARTICLE_SELECT)
          .gte("published_at", since)
          .order("published_at", { ascending: false })
          .limit(300);
        if (error) throw new Error(error.message);
        const { data: mine } = await admin.from("impact_analysis").select("article_id").eq("user_id", caller.userId);
        const have = new Set((mine ?? []).map((m: Row) => m.article_id as string));
        const ranked = ((data ?? []) as Row[])
          .map(toArticle)
          .filter((a) => !have.has(a.id))
          .map((a) => ({ a, r: computeRelevance(profile, a) }))
          .filter((x) => x.r.score >= SCORE_THRESHOLDS.medium)
          .sort((x, y) => y.r.score - x.r.score)
          .slice(0, BACKFILL_ARTICLES);
        candidatesConsidered = ranked.length;
        ranked.forEach((x) => plan.push({ article: x.a, profiles: [profile] }));
        storeIrrelevant = false;
      } else {
        return json({ error: "Provide article_id or mode: 'backfill'." }, 400);
      }
    }

    const planned = plan.reduce((n, p) => n + p.profiles.length, 0);
    if (!aiConfigured()) {
      return json(
        {
          error: "AI analysis is not configured. Set the AI_API_KEY secret for Edge Functions (supabase secrets set AI_API_KEY=...).",
          code: "ai_not_configured",
          candidates_considered: candidatesConsidered,
          analyses_planned: planned,
        },
        503,
      );
    }

    let generated = 0;
    const errors: string[] = [];
    for (const item of plan) {
      try {
        generated += await analyse(admin, item.article, item.profiles, storeIrrelevant);
      } catch (e) {
        errors.push(e instanceof AiRefusalError ? `Declined for article ${item.article.id}` : (e as Error).message);
      }
    }
    const summary = {
      generated,
      analyses_planned: planned,
      candidates_considered: candidatesConsidered,
      ai_model: AI_MODEL,
      errors,
      ...(errors.length && generated === 0 && planned > 0 ? { error: `Impact analysis failed: ${errors[0]}` } : {}),
    };
    console.log("generate-impact", JSON.stringify(summary));
    return json(summary, errors.length && generated === 0 && planned > 0 ? 502 : 200);
  } catch (e) {
    console.error("generate-impact failed", e);
    return json({ error: (e as Error).message }, 500);
  }
});
