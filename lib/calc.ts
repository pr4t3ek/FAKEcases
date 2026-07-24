/**
 * Safe arithmetic evaluator (no eval / Function). Supports + - * / ( ) and
 * Indian-friendly suffixes: k (thousand), L / lakh (1e5), cr / crore (1e7),
 * M (1e6), b / bn (1e9). Returns null on invalid input.
 */

function preprocess(input: string): string {
  return input
    .replace(/,/g, "")
    .replace(/\b(\d*\.?\d+)\s*(crore|cr)\b/gi, (_, n) => `(${n}*10000000)`)
    .replace(/\b(\d*\.?\d+)\s*(lakh|lac|l)\b/gi, (_, n) => `(${n}*100000)`)
    .replace(/\b(\d*\.?\d+)\s*(bn|b)\b/gi, (_, n) => `(${n}*1000000000)`)
    .replace(/\b(\d*\.?\d+)\s*(m)\b/gi, (_, n) => `(${n}*1000000)`)
    .replace(/\b(\d*\.?\d+)\s*(k)\b/gi, (_, n) => `(${n}*1000)`);
}

type Token = { type: "num"; value: number } | { type: "op"; value: string } | { type: "paren"; value: string };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === " ") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let num = "";
      while (i < input.length && /[0-9.eE]/.test(input[i])) {
        num += input[i];
        i++;
      }
      const value = Number(num);
      if (!isFinite(value)) return null;
      tokens.push({ type: "num", value });
      continue;
    }
    if ("+-*/".includes(c)) {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ type: "paren", value: c });
      i++;
      continue;
    }
    return null; // invalid char
  }
  return tokens;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

/** Shunting-yard to RPN, then evaluate. */
export function evaluateExpression(raw: string): number | null {
  if (!raw.trim()) return null;
  const tokens = tokenize(preprocess(raw));
  if (!tokens) return null;

  const output: Token[] = [];
  const ops: Token[] = [];
  for (const t of tokens) {
    if (t.type === "num") {
      output.push(t);
    } else if (t.type === "op") {
      while (
        ops.length &&
        ops[ops.length - 1].type === "op" &&
        PREC[ops[ops.length - 1].value] >= PREC[t.value]
      ) {
        output.push(ops.pop()!);
      }
      ops.push(t);
    } else if (t.value === "(") {
      ops.push(t);
    } else {
      // ")"
      while (ops.length && ops[ops.length - 1].value !== "(") {
        output.push(ops.pop()!);
      }
      if (!ops.length) return null; // mismatched
      ops.pop();
    }
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op.type === "paren") return null;
    output.push(op);
  }

  const stack: number[] = [];
  for (const t of output) {
    if (t.type === "num") {
      stack.push(t.value);
    } else if (t.type === "op") {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return null;
      switch (t.value) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/": stack.push(b === 0 ? NaN : a / b); break;
      }
    }
  }
  if (stack.length !== 1 || !isFinite(stack[0])) return null;
  return stack[0];
}
