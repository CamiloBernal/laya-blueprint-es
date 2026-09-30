// Build the downloadable editions of GUIA-LAYA.md: a self-contained HTML and a PDF.
//
// Usage: npm ci && npm run build        -> dist/GUIA-LAYA.html, dist/GUIA-LAYA.pdf
//
// Renders GitHub-flavoured Markdown with `marked`, turns GitHub alerts (> [!NOTE] ...) into
// styled callouts, renders ```mermaid blocks with the bundled mermaid library (no CDN), and
// prints the page to PDF with headless Chromium through Playwright.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoUrl = process.env.GUIDE_REPO_URL ?? "https://github.com/CamiloBernal/laya-blueprint-es";
const branch = process.env.GUIDE_BRANCH ?? "main";
const source = path.join(root, "GUIA-LAYA.md");
const outDir = path.join(root, "dist");

const ALERTS = {
  NOTE: { title: "Nota", icon: "ℹ️" },
  TIP: { title: "Consejo", icon: "💡" },
  IMPORTANT: { title: "Importante", icon: "❗" },
  WARNING: { title: "Advertencia", icon: "⚠️" },
  CAUTION: { title: "Precaución", icon: "🛑" },
};

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Relative links point at files in this repository; in a standalone download they must be absolute.
function absolutize(href) {
  if (!href || /^(https?:|mailto:|#)/.test(href)) return href;
  const clean = href.replace(/^\.\//, "");
  const kind = clean.endsWith("/") ? "tree" : "blob";
  return `${repoUrl}/${kind}/${branch}/${clean}`;
}

// "https://img.shields.io/badge/label-message-color" -> "label: message" ("--" is a literal dash).
function badgeLabel(href) {
  const m = /^https:\/\/img\.shields\.io\/badge\/([^?]+)/.exec(href ?? "");
  if (!m) return null;
  const parts = m[1].replace(/--/g, "\u0000").replace(/__/g, "\u0001").split("-").map((part) =>
    decodeURIComponent(part).replace(/\u0000/g, "-").replace(/\u0001/g, "_").replace(/_/g, " "));
  if (parts.length < 2) return null;
  parts.pop(); // color
  return parts.join(": ");
}

const marked = new Marked({ gfm: true });
marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre><code${cls}>${escapeHtml(text)}</code></pre>\n`;
    },
    blockquote({ tokens }) {
      const html = this.parser.parse(tokens);
      const match = html.match(/^\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/);
      if (!match) return `<blockquote>${html}</blockquote>\n`;
      const kind = match[1];
      const body = "<p>" + html.slice(match[0].length);
      const { title, icon } = ALERTS[kind];
      return `<div class="alert alert-${kind.toLowerCase()}"><p class="alert-title">${icon} ${title}</p>${body}</div>\n`;
    },
    // shields.io badges become local pills, so the PDF never depends on a network fetch.
    image({ href, title, text }) {
      const badge = badgeLabel(href);
      if (badge) return `<span class="badge">${escapeHtml(badge)}</span>`;
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${absolutize(href)}" alt="${escapeHtml(text)}"${t}>`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${absolutize(href)}"${t}>${text}</a>`;
    },
  },
});

const CSS = `
:root { --fg:#1f2328; --muted:#59636e; --border:#d1d9e0; --bg-code:#f6f8fa; --accent:#0969da; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; color: var(--fg);
       max-width: 980px; margin: 0 auto; padding: 32px 24px; line-height: 1.55; font-size: 15px; background: #fff; }
h1 { border-bottom: 1px solid var(--border); padding-bottom: .3em; margin-top: 1.6em; }
h2 { border-bottom: 1px solid var(--border); padding-bottom: .25em; margin-top: 1.8em; }
h1, h2, h3 { page-break-after: avoid; }
a { color: var(--accent); text-decoration: none; }
code { background: var(--bg-code); padding: .15em .35em; border-radius: 4px; font-size: 88%;
       font-family: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
pre { background: var(--bg-code); padding: 14px; border-radius: 6px; overflow-x: auto; font-size: 12.5px;
      line-height: 1.45; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
pre code { background: none; padding: 0; font-size: inherit; }
pre.mermaid { background: #fff; text-align: center; white-space: pre; }
table { border-collapse: collapse; margin: 12px 0; display: table; width: 100%; font-size: 13.5px; page-break-inside: auto; }
th, td { border: 1px solid var(--border); padding: 6px 10px; vertical-align: top; }
th { background: var(--bg-code); }
tr { page-break-inside: avoid; }
blockquote { color: var(--muted); border-left: 4px solid var(--border); margin: 0; padding: 0 1em; }
.alert { border-left: 4px solid; padding: 8px 16px; margin: 16px 0; border-radius: 4px; page-break-inside: avoid; }
.alert-title { font-weight: 600; margin: 4px 0; }
.alert-note { border-color:#0969da; background:#ddf4ff; } .alert-tip { border-color:#1a7f37; background:#dafbe1; }
.alert-important { border-color:#8250df; background:#fbefff; } .alert-warning { border-color:#9a6700; background:#fff8c5; }
.alert-caution { border-color:#cf222e; background:#ffebe9; }
details { border: 1px solid var(--border); border-radius: 6px; padding: 8px 14px; margin: 10px 0; }
summary { cursor: pointer; font-weight: 600; }
img { max-width: 100%; }
.badge { display: inline-block; font-size: 11px; padding: 2px 8px; margin: 2px; border-radius: 10px;
         background: #eef1f4; border: 1px solid var(--border); color: var(--fg); }
input[type=checkbox] { margin-right: .4em; }
@media print { body { max-width: none; padding: 0; } a { color: var(--fg); } }
`;

async function main() {
  const markdown = await readFile(source, "utf8");
  const body = marked.parse(markdown);
  const mermaidJs = await readFile(require.resolve("mermaid/dist/mermaid.min.js"), "utf8");
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laya: de cero a experto</title>
<style>${CSS}</style>
</head>
<body>
${body}
<script>${mermaidJs}</script>
<script>
  // Open every collapsible section so the downloadable edition shows all the content.
  document.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
  mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
  window.__mermaidDone = mermaid.run({ querySelector: "pre.mermaid" }).then(() => true, (e) => String(e));
</script>
</body>
</html>`;

  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  const htmlPath = path.join(outDir, "GUIA-LAYA.html");
  await writeFile(htmlPath, html, "utf8");

  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage();
    await page.goto("file://" + htmlPath, { waitUntil: "load" });
    const status = await page.evaluate(() => window.__mermaidDone);
    if (status !== true) throw new Error("mermaid rendering failed: " + status);
    const failed = await page.locator("pre.mermaid:not([data-processed])").count();
    if (failed) throw new Error(`${failed} mermaid diagram(s) were not rendered`);
    await page.pdf({
      path: path.join(outDir, "GUIA-LAYA.pdf"),
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:8px;width:100%;text-align:center;color:#59636e;">' +
        "Laya: de cero a experto · Camilo Bernal · camilobernal.dev · Apache-2.0 · página <span class=pageNumber></span> de <span class=totalPages></span></div>",
    });
  } finally {
    await browser.close();
  }
  console.log("built dist/GUIA-LAYA.html and dist/GUIA-LAYA.pdf");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
