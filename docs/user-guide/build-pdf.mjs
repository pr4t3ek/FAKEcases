/**
 * Builds docs/USER_GUIDE.pdf from docs/user-guide/USER_GUIDE.md.
 *
 * Usage:  node docs/user-guide/build-pdf.mjs
 *
 * The obvious route — export the .docx through LibreOffice — is the one to use
 * if you have a working `soffice`. This exists because the same markdown can be
 * laid out for print directly, which keeps the PDF from depending on a Word
 * conversion, and because Chromium is already installed for the screenshot
 * capture next door.
 *
 * `--html` writes the intermediate page instead of a PDF, which is the quickest
 * way to check a layout change.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseMarkdown, parseInline, sectionTitles } from "./md.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "USER_GUIDE.md");
const OUT = resolve(HERE, "..", "USER_GUIDE.pdf");
// The intermediate page is a build artefact, so it goes to a temp file unless
// --html asks for it next to the source.
const HTML_OUT = process.argv.includes("--html")
  ? join(HERE, "USER_GUIDE.preview.html")
  : join(tmpdir(), "case-closed-user-guide.html");
const CHROMIUM =
  process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const RELEASE = new Date().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (text) =>
  parseInline(text)
    .map((span) =>
      span.kind === "bold"
        ? `<strong>${esc(span.text)}</strong>`
        : span.kind === "code"
          ? `<code>${esc(span.text)}</code>`
          : esc(span.text),
    )
    .join("");

function body(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case "h":
        // The document's single H1 is the cover title, rendered separately.
        if (b.level === 1) break;
        out.push(`<h${b.level}>${inline(b.text)}</h${b.level}>`);
        break;
      case "p":
        out.push(`<p>${inline(b.text)}</p>`);
        break;
      case "list": {
        const tag = b.ordered ? "ol" : "ul";
        out.push(
          `<${tag}>${b.items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`,
        );
        break;
      }
      case "callout":
        out.push(`<aside>${inline(b.text)}</aside>`);
        break;
      case "table":
        out.push(
          `<table><thead><tr>${b.header
            .map((h) => `<th>${inline(h)}</th>`)
            .join("")}</tr></thead><tbody>${b.rows
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`,
        );
        break;
      case "figure": {
        const data = readFileSync(join(HERE, b.src)).toString("base64");
        out.push(
          `<figure><img src="data:image/png;base64,${data}" alt="${esc(b.caption)}">` +
            `<figcaption>${inline(b.caption)}</figcaption></figure>`,
        );
        break;
      }
      case "pagebreak":
        out.push('<div class="page-break"></div>');
        break;
    }
  }
  return out.join("\n");
}

function page(blocks) {
  const contents = sectionTitles(blocks)
    .map((t, n) => `<li><span class="n">${n + 1}.</span>${esc(t)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CASE CLOSED — User Guide</title>
<style>
  :root {
    --ink: #1a1a1a;
    --muted: #5c6470;
    --accent: #0f5c8c;
    --rule: #d6dae0;
    --callout: #eef4f9;
    --head: #e9edf2;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: var(--ink);
  }

  .cover { height: 247mm; display: flex; flex-direction: column; }
  .cover .spacer { flex: 0 0 62mm; }
  .cover .kicker {
    font-size: 9pt; font-weight: 700; letter-spacing: .22em;
    color: var(--accent); margin-bottom: 3mm;
  }
  .cover h1 { font-size: 40pt; line-height: 1.05; margin: 0; letter-spacing: -.01em; }
  .cover .sub {
    font-size: 13pt; color: var(--muted); margin: 2mm 0 4mm;
    padding-bottom: 5mm; border-bottom: 2px solid var(--accent);
  }
  .cover .lede { font-size: 11pt; max-width: 120mm; margin: 0 0 3mm; }
  .cover .who { font-weight: 700; }
  .cover .imprint { margin-top: auto; }
  .cover .imprint .org { font-weight: 700; }
  .cover .imprint .ver { color: var(--muted); font-size: 9.5pt; }

  .toc { page-break-after: always; }
  .toc h2 { border: 0; margin-top: 0; }
  .toc ol { list-style: none; padding: 0; margin: 0; }
  .toc li { padding: 1.6mm 0; border-bottom: 1px dotted var(--rule); }
  .toc .n { display: inline-block; width: 9mm; font-weight: 700; color: var(--accent); }

  h2 {
    font-size: 17pt; margin: 9mm 0 3mm; padding-bottom: 2mm;
    border-bottom: 1px solid var(--rule); break-after: avoid;
  }
  h3 { font-size: 12pt; color: var(--accent); margin: 6mm 0 2mm; break-after: avoid; }
  p { margin: 0 0 3mm; }
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 1.5mm; }
  code {
    font-family: "Consolas", "SF Mono", monospace; font-size: 9pt;
    background: #f2f4f7; padding: 0 1mm; border-radius: 2px;
  }

  aside {
    background: var(--callout); border-left: 3px solid var(--accent);
    padding: 3mm 4mm; margin: 0 0 4mm; break-inside: avoid;
  }

  table {
    width: 100%; border-collapse: collapse; margin: 0 0 4mm;
    font-size: 9.5pt; break-inside: avoid;
  }
  th, td { border: 1px solid var(--rule); padding: 1.8mm 2.4mm; text-align: left; vertical-align: top; }
  th { background: var(--head); font-weight: 700; }
  td:first-child, th:first-child { width: 30%; }

  figure { margin: 5mm 0 6mm; text-align: center; break-inside: avoid; }
  figure img {
    max-width: 100%; border: 1px solid var(--rule); border-radius: 3px;
  }
  figcaption { font-size: 8.5pt; font-style: italic; color: var(--muted); margin-top: 2mm; }

  .page-break { break-after: page; }
</style>
</head>
<body>
  <section class="cover">
    <div class="spacer"></div>
    <div class="kicker">USER GUIDE</div>
    <h1>CASE CLOSED</h1>
    <div class="sub">Practice for consulting and product-management interviews</div>
    <p class="lede">How to use the platform, what it is for, and how to run it in class.</p>
    <p class="who">For students and faculty</p>
    <div class="imprint">
      <div class="org">IIM Visakhapatnam</div>
      <div class="ver">Version 1.0 &middot; ${RELEASE}</div>
    </div>
  </section>
  <div class="page-break"></div>

  <section class="toc">
    <h2>Contents</h2>
    <ol>${contents}</ol>
  </section>

  ${body(blocks)}
</body>
</html>`;
}

const blocks = parseMarkdown(readFileSync(SRC, "utf8"));
const html = page(blocks);

if (process.argv.includes("--html")) {
  writeFileSync(HTML_OUT, html);
  console.log(`Wrote ${HTML_OUT}`);
} else {
  writeFileSync(HTML_OUT, html);
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });
  const page_ = await browser.newPage();
  await page_.goto(pathToFileURL(HTML_OUT).href, { waitUntil: "networkidle" });
  await page_.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "20mm", right: "20mm" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `
      <div style="width:100%;font-size:7.5pt;color:#5c6470;
                  font-family:'Segoe UI',Arial,sans-serif;
                  padding:0 20mm;display:flex;justify-content:space-between;">
        <span>CASE CLOSED &middot; User Guide</span>
        <span class="pageNumber"></span>
      </div>`,
  });
  await browser.close();
  console.log(`Wrote ${OUT}`);
}
