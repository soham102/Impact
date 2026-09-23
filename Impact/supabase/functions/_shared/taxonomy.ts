// Shared vocabulary used by both the Edge Functions (classification, candidate
// matching) and the web app (relevance model, "Why am I seeing this?").
// Pure TypeScript, no runtime dependencies, so it runs in Deno and in Vite.

export const CATEGORIES = [
  "AI",
  "Technology",
  "Startups",
  "Business",
  "Finance",
  "Economy",
  "Markets",
  "Career",
  "Education",
  "Politics",
  "Global",
  "Science",
  "Health",
  "Sports",
  "Real Estate",
  "Travel",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface TopicDef {
  name: string;
  category: Category;
  keywords: string[];
}

// Canonical topic list. `topics.name` rows are created from these names.
export const TOPICS: TopicDef[] = [
  { name: "Artificial Intelligence", category: "AI", keywords: ["ai", "artificial intelligence", "genai", "generative ai", "llm", "llms", "chatgpt", "openai", "machine learning", "deep learning", "gemini", "anthropic", "ai model", "ai models", "chatbot"] },
  { name: "Technology", category: "Technology", keywords: ["tech", "technology", "software", "smartphone", "semiconductor", "semiconductors", "chip", "chips", "cloud", "cybersecurity", "cyber", "digital", "internet", "saas", "5g", "data centre", "data center", "it services"] },
  { name: "Startups", category: "Startups", keywords: ["startup", "startups", "founder", "founders", "funding", "raises", "seed round", "series a", "series b", "series c", "unicorn", "venture capital", "vc", "angel investors"] },
  { name: "FinTech", category: "Finance", keywords: ["fintech", "upi", "digital payments", "payments", "neobank", "paytm", "phonepe", "razorpay", "digital lending", "npci"] },
  { name: "EdTech", category: "Education", keywords: ["edtech", "byju", "byju's", "unacademy", "physicswallah", "upgrad", "online learning", "e-learning", "ed-tech"] },
  { name: "Education", category: "Education", keywords: ["education", "school", "schools", "university", "universities", "college", "colleges", "students", "exam", "exams", "neet", "jee", "cbse", "ugc", "nep", "curriculum", "admissions", "mba", "campus", "degree"] },
  { name: "Jobs & Hiring", category: "Career", keywords: ["jobs", "job", "hiring", "layoffs", "layoff", "employment", "unemployment", "recruitment", "workforce", "salary", "salaries", "appraisal", "job market", "gig workers", "employees", "talent", "freshers", "campus placements"] },
  { name: "Product Management", category: "Career", keywords: ["product manager", "product managers", "product management", "product leader", "product leaders", "product role"] },
  { name: "Economy", category: "Economy", keywords: ["economy", "economic", "gdp", "inflation", "cpi", "fiscal", "budget", "recession", "trade deficit", "exports", "imports", "growth forecast", "gst"] },
  { name: "Monetary Policy", category: "Finance", keywords: ["rbi", "repo rate", "interest rate", "interest rates", "monetary policy", "reserve bank", "rate cut", "rate hike", "mpc"] },
  { name: "Markets", category: "Markets", keywords: ["sensex", "nifty", "stock market", "stocks", "shares", "ipo", "equity", "mutual fund", "mutual funds", "sebi", "investors", "bond", "bonds", "market cap"] },
  { name: "Banking & Finance", category: "Finance", keywords: ["bank", "banks", "banking", "loan", "loans", "credit", "nbfc", "insurance", "deposits", "finance"] },
  { name: "Real Estate", category: "Real Estate", keywords: ["real estate", "housing", "property", "properties", "home loan", "home loans", "realty", "rera", "apartment", "apartments", "residential", "homebuyers", "office space"] },
  { name: "Policy & Regulation", category: "Politics", keywords: ["regulation", "regulations", "regulator", "policy", "ministry", "bill", "law", "rules", "guidelines", "cabinet", "compliance", "government"] },
  { name: "Politics", category: "Politics", keywords: ["election", "elections", "bjp", "congress party", "parliament", "lok sabha", "rajya sabha", "politics", "political", "chief minister", "prime minister"] },
  { name: "Global Affairs", category: "Global", keywords: ["global", "geopolitics", "geopolitical", "tariff", "tariffs", "united nations", "trade war", "sanctions", "war", "china", "united states", "europe", "diplomatic"] },
  { name: "Science", category: "Science", keywords: ["science", "research", "researchers", "isro", "space", "scientists", "study finds", "space mission"] },
  { name: "Health", category: "Health", keywords: ["health", "hospital", "hospitals", "disease", "medical", "pharma", "healthcare", "vaccine", "patients"] },
  { name: "Sports", category: "Sports", keywords: ["cricket", "ipl", "football", "olympics", "sports", "bcci", "tournament", "world cup"] },
  { name: "Travel", category: "Travel", keywords: ["travel", "tourism", "tourists", "airline", "airlines", "flights", "airport", "visa", "hotel", "hotels"] },
  { name: "Business", category: "Business", keywords: ["company", "companies", "revenue", "profit", "acquisition", "acquire", "merger", "business", "corporate", "earnings", "quarterly results", "q1", "q2", "q3", "q4", "ceo"] },
  { name: "Energy", category: "Business", keywords: ["energy", "oil", "solar", "renewable", "renewables", "electric vehicle", "electric vehicles", "ev", "evs", "power sector"] },
];

export const TOPIC_NAMES = TOPICS.map((t) => t.name);

// Industries a user can pick and that articles are tagged with.
export const INDUSTRIES: { name: string; keywords: string[] }[] = [
  { name: "Technology", keywords: ["tech", "technology", "software", "ai", "artificial intelligence", "saas", "semiconductor", "it services", "cloud", "startup", "startups"] },
  { name: "Financial Services", keywords: ["bank", "banking", "fintech", "nbfc", "insurance", "mutual fund", "rbi", "lending", "payments", "upi", "sebi", "stock market"] },
  { name: "Education", keywords: ["education", "edtech", "school", "university", "college", "students", "exam"] },
  { name: "Healthcare", keywords: ["health", "healthcare", "hospital", "pharma", "medical", "vaccine"] },
  { name: "Real Estate", keywords: ["real estate", "housing", "property", "realty", "rera", "construction"] },
  { name: "Media & Entertainment", keywords: ["media", "entertainment", "film", "streaming", "ott", "bollywood", "advertising"] },
  { name: "Manufacturing", keywords: ["manufacturing", "factory", "factories", "production", "pli scheme", "industrial"] },
  { name: "Retail & E-commerce", keywords: ["retail", "e-commerce", "ecommerce", "quick commerce", "consumer", "fmcg", "flipkart", "amazon"] },
  { name: "Consulting", keywords: ["consulting", "consultancy", "advisory"] },
  { name: "Government & Public Sector", keywords: ["government", "ministry", "public sector", "psu", "policy"] },
  { name: "Energy", keywords: ["energy", "oil", "solar", "renewable", "power", "electric vehicle"] },
  { name: "Telecommunications", keywords: ["telecom", "5g", "jio", "airtel", "spectrum"] },
  { name: "Automotive", keywords: ["automotive", "auto", "car", "cars", "electric vehicle", "ev", "two-wheeler"] },
  { name: "Travel & Hospitality", keywords: ["travel", "tourism", "hotel", "hospitality", "airline", "aviation"] },
  { name: "Agriculture", keywords: ["agriculture", "farmers", "crop", "monsoon", "agritech"] },
];
export const INDUSTRY_NAMES = INDUSTRIES.map((i) => i.name);

// Locations recognised in headlines. Aliases map to a canonical name; `parent`
// lets a Mumbai user see Maharashtra news as local.
export const LOCATIONS: { name: string; aliases: string[]; parent?: string; kind: "city" | "state" | "country" }[] = [
  { name: "Mumbai", aliases: ["mumbai", "bombay", "navi mumbai", "thane"], parent: "Maharashtra", kind: "city" },
  { name: "Pune", aliases: ["pune"], parent: "Maharashtra", kind: "city" },
  { name: "Delhi", aliases: ["delhi", "new delhi", "delhi ncr", "ncr"], kind: "city" },
  { name: "Gurugram", aliases: ["gurugram", "gurgaon"], parent: "Haryana", kind: "city" },
  { name: "Noida", aliases: ["noida"], parent: "Uttar Pradesh", kind: "city" },
  { name: "Bengaluru", aliases: ["bengaluru", "bangalore"], parent: "Karnataka", kind: "city" },
  { name: "Hyderabad", aliases: ["hyderabad"], parent: "Telangana", kind: "city" },
  { name: "Chennai", aliases: ["chennai"], parent: "Tamil Nadu", kind: "city" },
  { name: "Kolkata", aliases: ["kolkata"], parent: "West Bengal", kind: "city" },
  { name: "Ahmedabad", aliases: ["ahmedabad"], parent: "Gujarat", kind: "city" },
  { name: "Jaipur", aliases: ["jaipur"], parent: "Rajasthan", kind: "city" },
  { name: "Kochi", aliases: ["kochi", "cochin"], parent: "Kerala", kind: "city" },
  { name: "Chandigarh", aliases: ["chandigarh"], kind: "city" },
  { name: "Lucknow", aliases: ["lucknow"], parent: "Uttar Pradesh", kind: "city" },
  { name: "Indore", aliases: ["indore"], parent: "Madhya Pradesh", kind: "city" },
  { name: "Maharashtra", aliases: ["maharashtra"], kind: "state" },
  { name: "Karnataka", aliases: ["karnataka"], kind: "state" },
  { name: "Tamil Nadu", aliases: ["tamil nadu"], kind: "state" },
  { name: "Telangana", aliases: ["telangana"], kind: "state" },
  { name: "Gujarat", aliases: ["gujarat"], kind: "state" },
  { name: "Kerala", aliases: ["kerala"], kind: "state" },
  { name: "Haryana", aliases: ["haryana"], kind: "state" },
  { name: "Uttar Pradesh", aliases: ["uttar pradesh"], kind: "state" },
  { name: "West Bengal", aliases: ["west bengal"], kind: "state" },
  { name: "Rajasthan", aliases: ["rajasthan"], kind: "state" },
  { name: "Madhya Pradesh", aliases: ["madhya pradesh"], kind: "state" },
  { name: "India", aliases: ["india", "indian", "indians"], kind: "country" },
  { name: "United States", aliases: ["united states", "u.s.", "usa", "american", "washington"], kind: "country" },
  { name: "China", aliases: ["china", "chinese", "beijing"], kind: "country" },
  { name: "United Kingdom", aliases: ["united kingdom", "uk", "britain", "british", "london"], kind: "country" },
  { name: "Singapore", aliases: ["singapore"], kind: "country" },
  { name: "UAE", aliases: ["uae", "dubai", "abu dhabi"], kind: "country" },
  { name: "Japan", aliases: ["japan", "japanese", "tokyo"], kind: "country" },
  { name: "Europe", aliases: ["europe", "european union", "eu"], kind: "country" },
];

// Google News queries used by fetch-news when the database has no
// `news_queries` table. `category` is a provisional category until
// classify-news runs.
export const DEFAULT_NEWS_QUERIES: { query: string; category: Category }[] = [
  { query: "AI India", category: "AI" },
  { query: "Artificial Intelligence India", category: "AI" },
  { query: "Indian startups", category: "Startups" },
  { query: "FinTech India", category: "Finance" },
  { query: "EdTech India", category: "Education" },
  { query: "Indian economy", category: "Economy" },
  { query: "RBI India", category: "Finance" },
  { query: "India jobs employment", category: "Career" },
  { query: "Product Management India", category: "Career" },
  { query: "Mumbai business", category: "Business" },
  { query: "Mumbai technology", category: "Technology" },
  { query: "Indian education", category: "Education" },
  { query: "Indian real estate", category: "Real Estate" },
  { query: "India stock market", category: "Markets" },
  { query: "India technology", category: "Technology" },
  { query: "global economy India", category: "Global" },
  { query: "India healthcare", category: "Health" },
  { query: "ISRO science India", category: "Science" },
  { query: "India cricket", category: "Sports" },
  { query: "India travel tourism", category: "Travel" },
  { query: "India government policy", category: "Politics" },
];

// ---- Profile → topic mappings (transparent; used for relevance and reasons) ----

// Interest names come from the `interests` table. Unknown names fall back to
// fuzzy matching against topic names.
export const INTEREST_TOPICS: Record<string, string[]> = {
  "AI & Technology": ["Artificial Intelligence", "Technology"],
  Startups: ["Startups"],
  Finance: ["Banking & Finance", "FinTech", "Monetary Policy", "Economy"],
  Investments: ["Markets", "Monetary Policy"],
  Career: ["Jobs & Hiring", "Product Management"],
  Education: ["Education", "EdTech"],
  EdTech: ["EdTech"],
  FinTech: ["FinTech"],
  Business: ["Business", "Startups"],
  "Politics & Government": ["Politics", "Policy & Regulation"],
  "Global Affairs": ["Global Affairs"],
  Science: ["Science"],
  Health: ["Health"],
  Sports: ["Sports"],
  "Real Estate": ["Real Estate"],
  Travel: ["Travel"],
};

export const GOAL_TOPICS: Record<string, string[]> = {
  "Finding a job": ["Jobs & Hiring", "Product Management"],
  "Growing my career": ["Jobs & Hiring", "Product Management"],
  "Building a business": ["Startups", "Business", "Policy & Regulation"],
  Investing: ["Markets", "Monetary Policy", "Economy"],
  "Buying a house": ["Real Estate", "Monetary Policy"],
  Studying: ["Education", "EdTech"],
  "Starting a startup": ["Startups"],
  "Learning new skills": ["EdTech", "Artificial Intelligence"],
  "Staying informed": [],
};

// "Location" and "Industry" are satisfied by the location/industry match itself.
export const IMPACT_AREA_TOPICS: Record<string, string[]> = {
  Career: ["Jobs & Hiring", "Product Management"],
  Finances: ["Economy", "Monetary Policy", "Banking & Finance"],
  Investments: ["Markets"],
  Business: ["Business", "Startups"],
  Education: ["Education", "EdTech"],
  Location: [],
  Industry: [],
  "Personal Decisions": ["Real Estate", "Health", "Travel"],
};

export const ROLES = ["Student", "Working Professional", "Founder", "Freelancer", "Job Seeker", "Other"] as const;

export const ROLE_TOPICS: Record<string, string[]> = {
  Student: ["Education", "EdTech", "Jobs & Hiring"],
  "Working Professional": ["Jobs & Hiring"],
  Founder: ["Startups", "Policy & Regulation"],
  Freelancer: ["Jobs & Hiring"],
  "Job Seeker": ["Jobs & Hiring"],
};

export const AGE_GROUPS = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+"];

// ---- Text helpers ----

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function textHasKeyword(text: string, keyword: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword.toLowerCase())}($|[^a-z0-9])`, "i");
  return re.test(text);
}

export function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Rule-based classifier: used when no LLM is configured and as a fallback
 *  for articles that have not been classified yet. */
export function classifyText(text: string): {
  topics: string[];
  industries: string[];
  locations: string[];
  category: Category | null;
} {
  const t = text.toLowerCase();
  const topicHits: { name: string; category: Category; hits: number }[] = [];
  for (const topic of TOPICS) {
    const hits = topic.keywords.filter((k) => textHasKeyword(t, k)).length;
    if (hits > 0) topicHits.push({ name: topic.name, category: topic.category, hits });
  }
  topicHits.sort((a, b) => b.hits - a.hits);
  const industries = INDUSTRIES.filter((i) => i.keywords.some((k) => textHasKeyword(t, k))).map((i) => i.name);
  const locations = LOCATIONS.filter((l) => l.aliases.some((a) => textHasKeyword(t, a))).map((l) => l.name);
  return {
    topics: topicHits.slice(0, 5).map((h) => h.name),
    industries: industries.slice(0, 3),
    locations: locations.slice(0, 4),
    category: topicHits[0]?.category ?? null,
  };
}

/** Canonical location name for free-text profile input like "Mumbai, India". */
export function resolveLocation(input: string | null | undefined): { city?: string; state?: string; country?: string } {
  const t = normalize(input);
  if (!t) return {};
  const out: { city?: string; state?: string; country?: string } = {};
  for (const l of LOCATIONS) {
    if (l.aliases.some((a) => textHasKeyword(t, a)) || normalize(l.name) === t) {
      if (l.kind === "city" && !out.city) {
        out.city = l.name;
        if (l.parent) out.state = l.parent;
        out.country = "India";
      } else if (l.kind === "state" && !out.state) {
        out.state = l.name;
        out.country = "India";
      } else if (l.kind === "country" && !out.country) {
        out.country = l.name;
      }
    }
  }
  return out;
}
