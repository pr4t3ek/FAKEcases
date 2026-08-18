/**
 * Making a model's answer readable in a plain-text bubble.
 *
 * The chat renders assistant turns as text with `whitespace-pre-wrap` — no
 * markdown renderer, no maths typesetting — which is the right shape for an
 * interviewer's two-sentence reply and completely wrong for what a small local
 * model actually sends. Ask a 7B for a worked calculation and it answers in
 * LaTeX inside markdown:
 *
 *   1. **Population Split:**
 *      - Old: \( 15 \text{ crore} \times 0.30 = 4.5 \text{ crore} \)
 *
 * which the student reads literally, backslashes and all. The prompt already
 * asks for prose ("no bullet lists, no headings") and a local model ignores it
 * often enough that asking harder is not a fix.
 *
 * So the text is normalised on the way to the screen. Pure and DB-free, and
 * applied at RENDER rather than on ingest for one reason: a streamed reply
 * arrives in fragments, and `\text{crore}` routinely straddles two of them.
 * Rewriting per-chunk would corrupt exactly the sequences this exists to fix,
 * while re-deriving from the accumulated string costs nothing and is always
 * working on whole tokens.
 *
 * Deliberately conservative. Anything unrecognised is left exactly as it was:
 * a student mis-reading one stray backslash is a much smaller failure than the
 * app quietly rewriting a number.
 *
 * The one thing it is NOT conservative about is a reasoning block. A model that
 * thinks out loud emits its deliberation in the same `content` stream as its
 * answer, and that deliberation quotes the system prompt back — the hard rules,
 * the ideal range, the sample solution. Leaking it does not just read badly, it
 * hands the student the answer key. So `<think>` is removed unconditionally, and
 * an unterminated one takes the rest of the reply with it.
 */

/** LaTeX commands with an obvious single-character meaning. */
const SYMBOLS: Record<string, string> = {
  times: "×",
  cdot: "·",
  div: "÷",
  approx: "≈",
  neq: "≠",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  pm: "±",
  infty: "∞",
  rightarrow: "→",
  to: "→",
  Rightarrow: "⇒",
  ldots: "…",
  dots: "…",
  sim: "~",
  ll: "≪",
  gg: "≫",
};

/**
 * Commands that wrap text they do not change: `\text{crore}` is just "crore".
 *
 * Matched one nesting level deep, which is all these ever arrive with. A
 * balanced-brace parser would buy nothing but a way to get it wrong.
 */
const WRAPPERS = /\\(?:text|textbf|textit|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g;

/**
 * Tags a reasoning model wraps its private deliberation in.
 *
 * `<think>` is the near-universal spelling; the others are the ones seen often
 * enough to be worth matching. Case-insensitive, because models are inconsistent
 * about it even within one reply.
 */
const THINK_TAGS = "think|thinking|reasoning|thought";

const CLOSED_THINK = new RegExp(`<\\s*(${THINK_TAGS})\\s*>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, "gi");
/** An opening tag with no partner: the reply was cut off mid-thought. */
const UNCLOSED_THINK = new RegExp(`<\\s*(?:${THINK_TAGS})\\s*>[\\s\\S]*$`, "i");
/** A stray closing tag, when the opener was lost to a trimmed transcript. */
const ORPHAN_CLOSE = new RegExp(`^[\\s\\S]*?<\\s*/\\s*(?:${THINK_TAGS})\\s*>`, "i");

/**
 * Remove a model's private reasoning.
 *
 * Order matters. Closed blocks go first, so a well-formed reply with reasoning
 * followed by an answer keeps the answer. Only then is a surviving opener treated
 * as unterminated — checking that first would swallow the answer that came after
 * a properly closed block.
 *
 * The orphan-close pass is last and is the one that recovers a truncated turn:
 * when the opening tag has been lost, everything up to and including the closing
 * tag is still reasoning.
 *
 * Exported for its own tests. A reply that was *entirely* reasoning correctly
 * returns an empty string — `runTurn` treats an empty turn as a failed one, which
 * is the honest outcome and far better than rendering the deliberation.
 */
export function stripReasoning(raw: string): string {
  if (!raw.includes("<")) return raw;
  return raw.replace(CLOSED_THINK, "").replace(UNCLOSED_THINK, "").replace(ORPHAN_CLOSE, "");
}

export function toReadableText(raw: string): string {
  if (!raw) return raw;
  // First, and before any rewriting: there is no point normalising LaTeX inside
  // text that is about to be thrown away, and a think block routinely contains
  // the sample solution.
  let out = stripReasoning(raw);
  if (!out.trim()) return "";

  // ── Maths delimiters ──────────────────────────────────────────────────────
  // Only the wrappers go; whatever sat inside is the actual content. Each takes
  // the whitespace on its inner side with it, so unwrapping introduces no gap of
  // its own — otherwise the leading space of "\( 15" would be indistinguishable
  // from a list item's indentation by the time the tidy-up runs.
  out = out.replace(/\\[([]\s*/g, "");
  out = out.replace(/\s*\\[)\]]/g, "");
  out = out.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, "$1");
  // `$…$` is deliberately NOT unwrapped. It is a real LaTeX delimiter, but it is
  // also a currency symbol, and the two are indistinguishable without parsing
  // the maths: "between $5 and $6" reads as a delimited pair and came out as
  // "between 5 and 6" — a destroyed price, in a app full of prices. A stray
  // dollar sign on screen is a far cheaper mistake than a wrong number, and the
  // commands inside are still converted either way. `$$…$$` stays because
  // nothing writes a doubled currency symbol.

  // ── Commands ─────────────────────────────────────────────────────────────
  out = out.replace(WRAPPERS, "$1");
  out = out.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2");
  out = out.replace(/\\(?:left|right)(?=[([\]).|])/g, "");
  out = out.replace(/\\([a-zA-Z]+)/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(SYMBOLS, name) ? SYMBOLS[name] : match,
  );
  // Escaped punctuation — `\%`, `\$`, `\&`, `\_`, `\#` — keeps the character.
  out = out.replace(/\\([%$&_#{}])/g, "$1");
  // A LaTeX line break is a line break.
  out = out.replace(/\\\\/g, "\n");

  // ── Markdown the bubble cannot render ────────────────────────────────────
  // Headings become plain lines. The text after the hashes is the content, and
  // the hashes themselves say nothing once nothing is styling them.
  out = out.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");
  // A horizontal rule is decoration in a chat bubble.
  out = out.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");

  // ── Tidy up after ourselves ──────────────────────────────────────────────
  // Unwrapping leaves gaps: `\text{ crore}` carries its own leading space, and
  // the delimiters around it had spaces too, so "15 \text{ crore}" lands as
  // "15  crore". Runs are collapsed only *after* a non-space character, because
  // the bubble is `whitespace-pre-wrap` and the leading spaces of a nested list
  // item are the indentation the model meant.
  out = out.replace(/(\S)[ \t]{2,}/g, "$1 ");
  out = out.replace(/[ \t]+$/gm, "");
  // Collapse the runs of blank lines the above can leave behind, then trim the
  // ends — leading NEWLINES only, never leading spaces. A plain `trim()` ate the
  // indentation of the first line, which on a nested list is the structure.
  return out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "");
}

/** A span of assistant text, and whether it was marked up. */
export interface TextSegment {
  text: string;
  kind: "plain" | "strong" | "code";
}

/**
 * Split normalised text into the few inline styles worth honouring.
 *
 * `**like this**` and `` `like this` `` are what models reach for constantly,
 * and showing the asterisks is worse than either rendering them or removing
 * them. Everything else — italics, links, tables — passes through as written,
 * because a chat bubble is not a document and half-rendered markdown reads worse
 * than none.
 *
 * Both patterns require their delimiters to pair on one line with something
 * between them, so a lone `*` in prose and a stray backtick are left alone.
 */
export function toSegments(text: string): TextSegment[] {
  const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  const segments: TextSegment[] = [];
  let last = 0;

  for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), kind: "plain" });
    segments.push(
      m[1] !== undefined ? { text: m[1], kind: "strong" } : { text: m[2], kind: "code" },
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), kind: "plain" });

  return segments.length ? segments : [{ text, kind: "plain" }];
}
