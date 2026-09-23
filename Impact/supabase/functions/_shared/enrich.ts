// Resolve a Google News RSS link to the publisher's article and read its
// preview metadata (og:image, og:description). Google News RSS carries no
// images, so this is how articles get real photos.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function timeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/** news.google.com/rss/articles/<id> → publisher URL (null if it can't be decoded). */
export async function resolveGoogleNewsUrl(link: string): Promise<string | null> {
  let id: string;
  try {
    const u = new URL(link);
    if (!u.hostname.endsWith("news.google.com")) return link;
    id = u.pathname.split("/").pop() ?? "";
  } catch {
    return null;
  }
  if (!id) return null;

  const page = await fetch(`https://news.google.com/articles/${id}`, { headers: { "User-Agent": UA }, signal: timeout(8000) });
  if (!page.ok) return null;
  const html = await page.text();
  const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) return null;

  const inner = [
    "garturlreq",
    [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    id,
    Number(ts),
    sg,
  ];
  const payload = [[["Fbv4je", JSON.stringify(inner), null, "generic"]]];
  const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": UA },
    body: "f.req=" + encodeURIComponent(JSON.stringify(payload)),
    signal: timeout(8000),
  });
  if (!res.ok) return null;
  const text = await res.text();
  const raw = text.match(/\[\\"garturlres\\",\\"(.*?)\\"/)?.[1];
  if (!raw) return null;
  const url = raw.replace(/\\\\u003d/g, "=").replace(/\\\\u0026/g, "&").replace(/\\\\\//g, "/");
  return /^https?:\/\//.test(url) ? url : null;
}

function meta(html: string, names: string[]): string | null {
  for (const name of names) {
    const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i"));
    if (a) return a[1];
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, "i"));
    if (b) return b[1];
  }
  return null;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export interface PageMeta {
  url: string;
  image: string | null;
  description: string | null;
}

/** Read og:image / og:description from a publisher page (first ~300 KB only). */
export async function fetchPageMeta(url: string): Promise<PageMeta | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: timeout(9000) });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
  const reader = res.body?.getReader();
  if (!reader) return null;
  let html = "";
  const dec = new TextDecoder();
  while (html.length < 300_000) {
    const { value, done } = await reader.read();
    if (done) break;
    html += dec.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  reader.cancel().catch(() => undefined);

  let image = meta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
  if (image) {
    try {
      image = new URL(decode(image), res.url || url).toString().replace(/^http:\/\//, "https://");
    } catch {
      image = null;
    }
  }
  // Skip generic site logos / placeholders.
  if (image && /logo|placeholder|default[-_]?(image|og)|favicon/i.test(image)) image = null;

  const descRaw = meta(html, ["og:description", "description", "twitter:description"]);
  const description = descRaw ? decode(descRaw) : null;
  return { url: res.url || url, image, description: description && description.length >= 40 ? description.slice(0, 600) : null };
}
