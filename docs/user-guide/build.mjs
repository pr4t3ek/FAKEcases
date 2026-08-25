/**
 * Builds docs/USER_GUIDE.docx from docs/user-guide/USER_GUIDE.md.
 *
 * Usage:  node docs/user-guide/build.mjs
 *
 * `docx` is not a dependency of the app — it is a docs tool. Install it where
 * you run this (`npm i docx`) rather than adding it to package.json.
 *
 * The markdown subset this understands is the one USER_GUIDE.md uses, and no
 * more: headings, paragraphs, bullet and numbered lists, pipe tables,
 * blockquote callouts, image figures, `---` page breaks, plus bold and code
 * spans inline. Anything else will come through as plain text, which is a loud enough
 * failure to notice.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseMarkdown, parseInline, sectionTitles } from "./md.mjs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "USER_GUIDE.md");
const OUT = resolve(HERE, "..", "USER_GUIDE.docx");

// Page geometry, in DXA (1440 = one inch). A4, one-inch margins.
const PAGE_WIDTH = 11906;
const MARGIN = 1440;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = "1A1A1A";
const MUTED = "5C6470";
const ACCENT = "0F5C8C";
const RULE = "D6DAE0";
const CALLOUT_BG = "EEF4F9";
const HEAD_BG = "E9EDF2";

// ── blocks → docx ───────────────────────────────────────────────────────────

/** One markdown line as docx runs. */
function runs(text, base = {}) {
  return parseInline(text).map((span) =>
    span.kind === "bold"
      ? new TextRun({ text: span.text, bold: true, ...base })
      : span.kind === "code"
        ? new TextRun({ text: span.text, font: "Consolas", size: 19, ...base })
        : new TextRun({ text: span.text, ...base }),
  );
}

function cell(text, { header = false, width } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 90, bottom: 90, left: 130, right: 130 },
    shading: header
      ? { type: ShadingType.CLEAR, fill: HEAD_BG, color: "auto" }
      : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 2, color: RULE },
    },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: runs(text, { size: 19, bold: header || undefined, color: INK }),
      }),
    ],
  });
}

function tableOf(block) {
  const cols = block.header.length;
  // First column a little wider than the rest: every table here is
  // "term → explanation", and the explanation is the long half.
  const first = Math.round(TEXT_WIDTH * (cols === 2 ? 0.34 : 0.26));
  const rest = Math.round((TEXT_WIDTH - first) / (cols - 1));
  const widths = [first, ...Array(cols - 1).fill(rest)];
  widths[cols - 1] = TEXT_WIDTH - widths.slice(0, -1).reduce((a, b) => a + b, 0);

  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: block.header.map((h, n) => cell(h, { header: true, width: widths[n] })),
      }),
      ...block.rows.map(
        (r) =>
          new TableRow({
            children: r.map((c, n) => cell(c, { width: widths[n] })),
          }),
      ),
    ],
  });
}

function figureOf(block) {
  const path = join(HERE, block.src);
  if (!existsSync(path)) {
    console.warn(`  ! missing image: ${block.src}`);
    return [];
  }
  // Every screenshot is captured at 1440×900 CSS px on a 2× display.
  const maxWidthPx = 620;
  const isCrop = block.src.includes("framework-builder");
  const ratio = isCrop ? 645 / 915 : 900 / 1440;

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      keepNext: true,
      children: [
        new ImageRun({
          type: "png",
          data: readFileSync(path),
          transformation: { width: maxWidthPx, height: Math.round(maxWidthPx * ratio) },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 260 },
      children: runs(block.caption, { size: 17, italics: true, color: MUTED }),
    }),
  ];
}

function render(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case "h":
        out.push(
          new Paragraph({
            heading:
              b.level === 1
                ? HeadingLevel.HEADING_1
                : b.level === 2
                  ? HeadingLevel.HEADING_1
                  : HeadingLevel.HEADING_2,
            spacing: { before: b.level >= 3 ? 300 : 380, after: 160 },
            keepNext: true,
            children: runs(b.text),
          }),
        );
        break;
      case "p":
        out.push(
          new Paragraph({
            spacing: { before: 0, after: 160, line: 300 },
            children: runs(b.text, { size: 21, color: INK }),
          }),
        );
        break;
      case "list":
        b.items.forEach((item) =>
          out.push(
            new Paragraph({
              spacing: { before: 0, after: 100, line: 300 },
              ...(b.ordered
                ? { numbering: { reference: "steps", level: 0 } }
                : { numbering: { reference: "bullets", level: 0 } }),
              children: runs(item, { size: 21, color: INK }),
            }),
          ),
        );
        break;
      case "callout":
        out.push(
          new Paragraph({
            spacing: { before: 160, after: 220, line: 300 },
            indent: { left: 220, right: 220 },
            shading: { type: ShadingType.CLEAR, fill: CALLOUT_BG, color: "auto" },
            border: {
              left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 12 },
              top: { style: BorderStyle.SINGLE, size: 2, color: CALLOUT_BG, space: 8 },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: CALLOUT_BG, space: 8 },
              right: { style: BorderStyle.SINGLE, size: 2, color: CALLOUT_BG, space: 8 },
            },
            children: runs(b.text, { size: 20, color: INK }),
          }),
        );
        break;
      case "table":
        out.push(tableOf(b));
        out.push(new Paragraph({ spacing: { before: 0, after: 240 }, children: [] }));
        break;
      case "figure":
        out.push(...figureOf(b));
        break;
      case "pagebreak":
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
    }
  }
  return out;
}

// ── cover and contents ──────────────────────────────────────────────────────

const RELEASE = new Date().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function cover() {
  const rule = (space) => ({
    bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space },
  });
  return [
    new Paragraph({ spacing: { before: 2600, after: 0 }, children: [] }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: "USER GUIDE",
          size: 22,
          bold: true,
          color: ACCENT,
          characterSpacing: 60,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: "CASE CLOSED", size: 68, bold: true, color: INK })],
    }),
    new Paragraph({
      border: rule(200),
      spacing: { before: 60, after: 320 },
      children: [
        new TextRun({
          text: "Practice for consulting and product-management interviews",
          size: 26,
          color: MUTED,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120, line: 320 },
      children: [
        new TextRun({
          text: "How to use the platform, what it is for, and how to run it in class.",
          size: 22,
          color: INK,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: "For students and faculty", size: 21, bold: true, color: INK }),
      ],
    }),
    new Paragraph({ spacing: { before: 1400, after: 0 }, children: [] }),
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({ text: "IIM Visakhapatnam", size: 22, bold: true, color: INK }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: `Version 1.0 · ${RELEASE}`, size: 19, color: MUTED })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

/**
 * A written-out contents page rather than a field-based TOC: a Word TOC field
 * renders as "right-click to update" until someone opens the file in Word, and
 * this document is read as a PDF as often as in Word.
 */
function contents(blocks) {
  const entries = sectionTitles(blocks);

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240 },
      children: runs("Contents"),
    }),
    ...entries.map(
      (text, n) =>
        new Paragraph({
          spacing: { before: 0, after: 130 },
          tabStops: [{ type: "left", position: 620 }],
          children: [
            new TextRun({ text: `${n + 1}.`, size: 21, bold: true, color: ACCENT }),
            new TextRun({ text: "\t", size: 21 }),
            new TextRun({ text, size: 21, color: INK }),
          ],
        }),
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── document ────────────────────────────────────────────────────────────────

const md = readFileSync(SRC, "utf8");
const blocks = parseMarkdown(md);
// The H1 is the cover title; it must not repeat as the first body heading.
const body = blocks.filter((b) => !(b.type === "h" && b.level === 1));

const doc = new Document({
  creator: "IIM Visakhapatnam",
  title: "CASE CLOSED — User Guide",
  description: "How to use the CASE CLOSED interview-practice platform.",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 21, color: INK } },
      heading1: {
        run: { font: "Calibri", size: 30, bold: true, color: INK },
        paragraph: { spacing: { before: 380, after: 160 } },
      },
      heading2: {
        run: { font: "Calibri", size: 24, bold: true, color: ACCENT },
        paragraph: { spacing: { before: 300, after: 140 } },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 220 } } },
          },
        ],
      },
      {
        reference: "steps",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 220 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: 16838 },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
        titlePage: true,
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 0 },
              border: { top: { style: BorderStyle.SINGLE, size: 2, color: RULE, space: 8 } },
              children: [
                new TextRun({ text: "CASE CLOSED · User Guide", size: 16, color: MUTED }),
                new TextRun({ text: "    ", size: 16 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
              ],
            }),
          ],
        }),
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
      },
      children: [...cover(), ...contents(blocks), ...render(body)],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUT, buffer);
console.log(`Wrote ${OUT} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
