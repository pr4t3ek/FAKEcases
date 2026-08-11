"use client";

/**
 * An assistant turn, rendered.
 *
 * The bubble has always been `whitespace-pre-wrap` around a raw string, which
 * suits an interviewer's two sentences and fails the moment a model answers a
 * calculation — a local one will send LaTeX inside markdown, and the student
 * reads the backslashes. `toReadableText` handles the maths; this handles the
 * two inline styles that are worth honouring rather than deleting.
 *
 * Not a markdown renderer, and deliberately not: pulling one in for bold and
 * code would add a dependency and a rendering surface to an app that keeps its
 * chat as text on purpose. Anything it does not recognise is printed exactly as
 * the model wrote it.
 */

import { toReadableText, toSegments } from "@/lib/llm/plain-text";

export function AssistantText({ children }: { children: string }) {
  const segments = toSegments(toReadableText(children));

  return (
    <>
      {segments.map((segment, i) =>
        segment.kind === "strong" ? (
          <strong key={i} className="font-semibold">
            {segment.text}
          </strong>
        ) : segment.kind === "code" ? (
          <code key={i} className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.9em]">
            {segment.text}
          </code>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}
