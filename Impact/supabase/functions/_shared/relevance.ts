// Transparent relevance model shared by the web app (feed ranking and
// "Why am I seeing this?") and generate-impact (candidate-user pre-filter, so
// AI analysis only runs for users an article plausibly matters to).
//
// Weights:  interest +2 (max 2 interests) · industry +3 · role +3
//           location +2 (country-only +1) · goal +2 (max 2 goals) · impact area +2
// Every point awarded carries a human-readable reason derived from the user's
// actual profile. No reason is ever produced without a matching signal.

import {
  classifyText,
  GOAL_TOPICS,
  IMPACT_AREA_TOPICS,
  INTEREST_TOPICS,
  normalize,
  resolveLocation,
  ROLE_TOPICS,
  TOPIC_NAMES,
  textHasKeyword,
} from "./taxonomy.ts";

export type ImpactLevel = "high" | "medium" | "low";

export interface RelevanceProfile {
  role: string | null;
  industry: string | null;
  location: string | null;
  interests: string[];
  goals: string[];
  impactAreas: string[];
}

export interface RelevanceArticle {
  title: string;
  summary?: string | null;
  category?: string | null;
  topics: string[];
  industries: string[];
  locations: string[];
}

export type ReasonKind = "interest" | "industry" | "role" | "location" | "goal" | "impact_area";

export interface Reason {
  kind: ReasonKind;
  label: string; // short chip label, e.g. "EdTech"
  text: string; // full sentence, e.g. "You follow EdTech"
  points: number;
}

export interface RelevanceResult {
  score: number;
  level: ImpactLevel | null; // null = not relevant enough for the personal feed
  reasons: Reason[];
}

export const SCORE_THRESHOLDS = { high: 8, medium: 5, low: 2 } as const;

export function levelFromScore(score: number): ImpactLevel | null {
  if (score >= SCORE_THRESHOLDS.high) return "high";
  if (score >= SCORE_THRESHOLDS.medium) return "medium";
  if (score >= SCORE_THRESHOLDS.low) return "low";
  return null;
}

/** impact_analysis.relevance_score is stored 0–100 by generate-impact. */
export function levelFromAnalysisScore(score: number | null | undefined): ImpactLevel | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  const s = score <= 1 ? score * 100 : score <= 10 ? score * 10 : score;
  if (s >= 70) return "high";
  if (s >= 40) return "medium";
  return "low";
}

const ROLE_REASON: Record<string, string> = {
  Student: "You're a student",
  "Working Professional": "You're a working professional",
  Founder: "You're a founder",
  Freelancer: "You work as a freelancer",
  "Job Seeker": "You're looking for a job",
};

function topicsForInterest(interest: string): string[] {
  const mapped = INTEREST_TOPICS[interest];
  if (mapped) return mapped;
  const n = normalize(interest);
  return TOPIC_NAMES.filter((t) => normalize(t).includes(n) || n.includes(normalize(t)));
}

/** Fill in metadata from the headline when the article has not been classified yet. */
export function effectiveArticle(a: RelevanceArticle): RelevanceArticle {
  if (a.topics.length && a.industries.length && a.locations.length) return a;
  const derived = classifyText(`${a.title} ${a.summary ?? ""}`);
  return {
    ...a,
    topics: a.topics.length ? a.topics : derived.topics,
    industries: a.industries.length ? a.industries : derived.industries,
    locations: a.locations.length ? a.locations : derived.locations,
  };
}

export function computeRelevance(profile: RelevanceProfile, rawArticle: RelevanceArticle): RelevanceResult {
  const article = effectiveArticle(rawArticle);
  const topicSet = new Set(article.topics.map(normalize));
  const hasTopic = (names: string[]) => names.some((n) => topicSet.has(normalize(n)));
  const text = `${article.title} ${article.summary ?? ""}`.toLowerCase();
  const reasons: Reason[] = [];

  // Interests (+2 each, max 2)
  let interestHits = 0;
  for (const interest of profile.interests) {
    if (interestHits >= 2) break;
    if (hasTopic(topicsForInterest(interest))) {
      reasons.push({ kind: "interest", label: interest, text: `You follow ${interest}`, points: 2 });
      interestHits++;
    }
  }

  // Industry (+3)
  let industryMatched = false;
  if (profile.industry && normalize(profile.industry) !== "other") {
    const ind = normalize(profile.industry);
    industryMatched = article.industries.some((i) => normalize(i) === ind) || textHasKeyword(text, ind);
    if (industryMatched) {
      reasons.push({ kind: "industry", label: profile.industry, text: `Your industry is ${profile.industry}`, points: 3 });
    }
  }

  // Role (+3)
  if (profile.role) {
    const roleTopics = ROLE_TOPICS[profile.role];
    const matched = roleTopics ? hasTopic(roleTopics) : textHasKeyword(text, normalize(profile.role));
    if (matched) {
      reasons.push({
        kind: "role",
        label: profile.role,
        text: ROLE_REASON[profile.role] ?? `You work in ${profile.role}`,
        points: 3,
      });
    }
  }

  // Location (+2 city/state, +1 country only)
  let locationMatched = false;
  const loc = resolveLocation(profile.location);
  const artLocs = new Set(article.locations.map(normalize));
  if (loc.city && artLocs.has(normalize(loc.city))) {
    reasons.push({ kind: "location", label: loc.city, text: `You're based in ${loc.city}`, points: 2 });
    locationMatched = true;
  } else if (loc.state && artLocs.has(normalize(loc.state))) {
    reasons.push({ kind: "location", label: loc.state, text: `It concerns ${loc.state}, where you're based`, points: 2 });
    locationMatched = true;
  } else if (loc.country && artLocs.has(normalize(loc.country))) {
    reasons.push({ kind: "location", label: loc.country, text: `It concerns ${loc.country}, where you're based`, points: 1 });
    locationMatched = true;
  }

  // Goals (+2 each, max 2)
  let goalHits = 0;
  for (const goal of profile.goals) {
    if (goalHits >= 2) break;
    const topics = GOAL_TOPICS[goal] ?? [];
    if (topics.length && hasTopic(topics)) {
      reasons.push({ kind: "goal", label: goal, text: `“${goal}” is one of your goals`, points: 2 });
      goalHits++;
    }
  }

  // Impact areas (+2 once)
  for (const area of profile.impactAreas) {
    const topics = IMPACT_AREA_TOPICS[area] ?? [];
    const matched =
      (area === "Location" && locationMatched) || (area === "Industry" && industryMatched) || (topics.length > 0 && hasTopic(topics));
    if (matched) {
      reasons.push({
        kind: "impact_area",
        label: area,
        text:
          area === "Location"
            ? "You want to understand local impact"
            : `You want to understand the impact on your ${area.toLowerCase()}`,
        points: 2,
      });
      break;
    }
  }

  const score = reasons.reduce((s, r) => s + r.points, 0);
  return { score, level: levelFromScore(score), reasons };
}
