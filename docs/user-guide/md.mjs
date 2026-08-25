/**
 * The markdown subset USER_GUIDE.md is written in, parsed into flat blocks.
 *
 * Shared by build.mjs (Word) and build-pdf.mjs (PDF) so the two deliverables
 * cannot drift: there is one source document and one reading of it.
 *
 * Handles: `#`/`##`/`###` headings, paragraphs, `-` bullets, `1.` numbered
 * lists, pipe tables, `>` callouts, image figures, `---` page breaks, and
 * bold and code spans inline. Anything else falls through as plain text,
 * which is a loud enough failure to notice.
 */

/** @returns {Array<{type: string, [k: string]: unknown}>} */
export function parseMarkdown(md) {
  const lines = md.split("\n");
  const blocks = [];
  let i = 0;
  let para = [];

  const flush = () => {
    const text = para.join(" ").trim();
    if (text) blocks.push({ type: "p", text });
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith("<!--")) {
      while (i < lines.length && !lines[i].includes("-->")) i++;
      i++;
      continue;
    }

    if (!line.trim()) {
      flush();
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "h", level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      flush();
      blocks.push({ type: "pagebreak" });
      i++;
      continue;
    }

    const figure = /^!\[(.*)\]\((.*)\)\s*$/.exec(line);
    if (figure) {
      flush();
      blocks.push({ type: "figure", caption: figure[1], src: figure[2] });
      i++;
      continue;
    }

    if (line.startsWith("> ")) {
      flush();
      const buf = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        buf.push(lines[i].slice(2).trim());
        i++;
      }
      blocks.push({ type: "callout", text: buf.join(" ") });
      continue;
    }

    if (line.startsWith("|")) {
      flush();
      const raw = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        raw.push(lines[i]);
        i++;
      }
      const cells = raw
        .filter((r) => !/^\|[\s:|-]+\|$/.test(r.trim()))
        .map((r) =>
          r
            .replace(/^\|/, "")
            .replace(/\|\s*$/, "")
            .split("|")
            .map((c) => c.trim()),
        );
      blocks.push({ type: "table", header: cells[0], rows: cells.slice(1) });
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      flush();
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length) {
        const m = ordered ? /^\d+\.\s+(.*)$/.exec(lines[i]) : /^[-*]\s+(.*)$/.exec(lines[i]);
        if (!m) {
          // A wrapped continuation line, indented under its item.
          if (items.length && /^\s{2,}\S/.test(lines[i])) {
            items[items.length - 1] += ` ${lines[i].trim()}`;
            i++;
            continue;
          }
          break;
        }
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flush();
  return blocks;
}

/**
 * Split one line into bold, code and plain spans.
 * @returns {Array<{kind: "text"|"bold"|"code", text: string}>}
 */
export function parseInline(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    const tok = m[0];
    out.push(
      tok.startsWith("**")
        ? { kind: "bold", text: tok.slice(2, -2) }
        : { kind: "code", text: tok.slice(1, -1) },
    );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out.length ? out : [{ kind: "text", text: "" }];
}

/** The numbered section titles, for a contents page. */
export function sectionTitles(blocks) {
  return blocks
    .filter((b) => b.type === "h" && b.level === 2)
    .map((b) => b.text.replace(/^\d+\.\s*/, ""));
}
