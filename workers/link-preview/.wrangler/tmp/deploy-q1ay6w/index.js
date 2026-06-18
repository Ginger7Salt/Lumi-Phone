var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
var MAX_URLS = 3;
var MAX_HTML_BYTES = 512e3;
var FETCH_TIMEOUT_MS = 12e3;
var MAX_EXCERPT_CHARS = 1200;
var BLOCKED_HOSTS = /* @__PURE__ */ new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "::1",
  "metadata.google.internal",
  "metadata.goog"
]);
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS }
  });
}
__name(json, "json");
function isPrivateIpv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const parts = m.slice(1).map((x) => Number(x));
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
__name(isPrivateIpv4, "isPrivateIpv4");
function isBlockedHost(hostname) {
  const host = hostname.trim().toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}
__name(isBlockedHost, "isBlockedHost");
function validatePublicHttpsUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  const port = parsed.port ? Number(parsed.port) : 443;
  if (port !== 443) return null;
  if (isBlockedHost(parsed.hostname)) return null;
  return parsed;
}
__name(validatePublicHttpsUrl, "validatePublicHttpsUrl");
function decodeHtmlEntities(input) {
  return input.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
__name(decodeHtmlEntities, "decodeHtmlEntities");
function readMetaContent(html, key, attr) {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i"
  );
  return decodeHtmlEntities(html.match(re)?.[1] ?? html.match(re2)?.[1] ?? "").trim();
}
__name(readMetaContent, "readMetaContent");
function extractTitle(html) {
  const og = readMetaContent(html, "og:title", "property");
  if (og) return og;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return decodeHtmlEntities(title ?? "").replace(/\s+/g, " ").trim();
}
__name(extractTitle, "extractTitle");
function extractDescription(html) {
  const og = readMetaContent(html, "og:description", "property");
  if (og) return og;
  const desc = readMetaContent(html, "description", "name");
  if (desc) return desc;
  return readMetaContent(html, "twitter:description", "name");
}
__name(extractDescription, "extractDescription");
function extractBodyExcerpt(html) {
  const article = html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1];
  const main = html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1];
  const body = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const source = article || main || body;
  const text = decodeHtmlEntities(
    source.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  );
  return text.slice(0, MAX_EXCERPT_CHARS).trim();
}
__name(extractBodyExcerpt, "extractBodyExcerpt");
async function fetchHtmlWithGuards(startUrl) {
  let current = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "User-Agent": "LumiLinkPreview/1.0 (+https://github.com/Lumi-Phone)"
        }
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error("\u91CD\u5B9A\u5411\u7F3A\u5C11 Location");
        const next = new URL(location, current);
        const validated = validatePublicHttpsUrl(next.toString());
        if (!validated) throw new Error("\u91CD\u5B9A\u5411\u76EE\u6807\u4E0D\u5141\u8BB8");
        current = validated;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        throw new Error("\u975E HTML \u9875\u9762");
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_HTML_BYTES) throw new Error("\u9875\u9762\u8FC7\u5927");
      const html = new TextDecoder("utf-8").decode(buf);
      return { html, finalUrl: current.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("\u91CD\u5B9A\u5411\u6B21\u6570\u8FC7\u591A");
}
__name(fetchHtmlWithGuards, "fetchHtmlWithGuards");
async function previewOne(rawUrl) {
  const validated = validatePublicHttpsUrl(rawUrl);
  if (!validated) {
    return { url: rawUrl, ok: false, error: "\u4EC5\u652F\u6301\u516C\u5F00 https \u94FE\u63A5" };
  }
  try {
    const { html, finalUrl } = await fetchHtmlWithGuards(validated);
    const title = extractTitle(html);
    const description = extractDescription(html);
    const excerpt = extractBodyExcerpt(html);
    if (!title && !description && !excerpt) {
      return { url: finalUrl, ok: false, error: "\u672A\u80FD\u63D0\u53D6\u6B63\u6587" };
    }
    return {
      url: finalUrl,
      ok: true,
      title: title || void 0,
      description: description || void 0,
      excerpt: excerpt || void 0
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { url: validated.toString(), ok: false, error: msg || "\u6293\u53D6\u5931\u8D25" };
  }
}
__name(previewOne, "previewOne");
var index_default = {
  async fetch(request, _env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    try {
      if (request.method === "GET" && path === "/health") {
        return json({ ok: true, service: "link-preview" });
      }
      if (request.method === "POST" && path === "/preview") {
        const body = await request.json();
        const list = [
          ...Array.isArray(body.urls) ? body.urls : [],
          ...body.url?.trim() ? [body.url.trim()] : []
        ].map((u) => String(u ?? "").trim()).filter(Boolean);
        const unique = [...new Set(list)].slice(0, MAX_URLS);
        if (!unique.length) return json({ ok: false, message: "\u7F3A\u5C11 url \u6216 urls" }, 400);
        const previews = await Promise.all(unique.map((u) => previewOne(u)));
        return json({ ok: true, previews });
      }
      return json({ ok: false, message: "Not Found" }, 404);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ ok: false, message: msg }, 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
