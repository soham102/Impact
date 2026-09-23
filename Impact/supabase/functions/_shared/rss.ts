// Minimal, dependency-free parser for Google News RSS feeds.
// Google News RSS: https://news.google.com/rss/search?q=<query>&hl=en-IN&gl=IN&ceid=IN:en

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  source: string | null;
  sourceUrl: string | null;
  description: string | null;
  publishedAt: string | null; // ISO
}

export function googleNewsSearchUrl(query: string, opts: { hl?: string; gl?: string; ceid?: string; window?: string } = {}): string {
  const hl = opts.hl ?? "en-IN";
  const gl = opts.gl ?? "IN";
  const ceid = opts.ceid ?? "IN:en";
  const q = opts.window ? `${query} when:${opts.window}` : query;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

function unwrapCdata(s: string): string {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : s;
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? unwrapCdata(m[1]) : null;
}

function attr(xml: string, name: string, attribute: string): string | null {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*${attribute}="([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

export function stripHtml(html: string): string {
  // Entities are decoded twice because Google News double-encodes the description HTML.
  return decodeEntities(decodeEntities(html).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseGoogleNewsRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const rawTitle = decodeEntities(tag(block, "title") ?? "").trim();
    const link = decodeEntities(tag(block, "link") ?? "").trim();
    const guid = decodeEntities(tag(block, "guid") ?? "").trim() || link;
    const source = tag(block, "source");
    const sourceName = source ? decodeEntities(source).trim() : null;
    const sourceUrl = attr(block, "source", "url");
    const pub = tag(block, "pubDate");
    const date = pub ? new Date(pub.trim()) : null;
    if (!rawTitle || !link) continue;

    // Google appends " - Publisher" to titles; remove it when it matches the source.
    let title = rawTitle;
    if (sourceName && title.endsWith(` - ${sourceName}`)) {
      title = title.slice(0, -(` - ${sourceName}`.length)).trim();
    }

    // The RSS description is just the headline + publisher (or a list of related
    // headlines). Only keep it when it adds text beyond the headline.
    const descRaw = tag(block, "description");
    let description: string | null = descRaw ? stripHtml(descRaw) : null;
    if (description) {
      let d = description;
      if (sourceName && d.endsWith(sourceName)) d = d.slice(0, -sourceName.length).trim();
      if (d === title || d === rawTitle || d.length < title.length + 20) description = null;
      else description = d;
    }

    items.push({
      title,
      link,
      guid,
      source: sourceName,
      sourceUrl,
      description,
      publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    });
  }
  return items;
}
