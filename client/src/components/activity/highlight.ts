// A small syntax highlighter for Parsons blocks, in the spirit of prettify's
// default lexer (which js-parsons uses). Parsons activities don't say which
// language they are in, so it knows a little about several at once.

// The kinds of token prettify colors, with its class names: keyword, string,
// comment, type, literal (numbers), punctuation and plain text.
export type TokenKind = "kwd" | "str" | "com" | "typ" | "lit" | "pun" | "pln";

// One piece of a block's code and how to color it.
export interface Token {
  text: string;
  kind: TokenKind;
}

// prettify's colors, darkened so every token keeps a 4.5:1 contrast (WCAG AA)
// on every block background: plain #EFEFEF, green #DFF2BF and red #FFBABA.
// Plain text keeps the block's own color.
export const TOKEN_COLORS: Record<TokenKind, string> = {
  kwd: "#000088",
  str: "#006400",
  com: "#880000",
  typ: "#660066",
  lit: "#005555",
  pun: "#555500",
  pln: "inherit",
};

// Keywords of Python, JavaScript, TypeScript, Java, C and C++, plus their
// literal words. Words that are also common names (print, type, string,
// number...) are left out so they stay plain.
const KEYWORDS = new Set(
  [
    // Python
    "and as assert async await break class continue def del elif else except finally for from global",
    "if import in is lambda nonlocal not or pass raise return try while with yield",
    // JavaScript and TypeScript
    "case catch const debugger default delete do export extends function instanceof let new super switch",
    "this throw typeof var void abstract declare enum implements infer interface keyof namespace never",
    "private protected public readonly satisfies unknown",
    // Java
    "boolean byte char double final float goto int long native package short static strictfp synchronized",
    "throws transient volatile",
    // C and C++
    "auto extern inline register restrict signed sizeof struct typedef union unsigned alignas alignof asm",
    "bool char16_t char32_t char8_t co_await co_return co_yield concept consteval constexpr constinit",
    "const_cast decltype dynamic_cast explicit friend mutable noexcept operator reinterpret_cast requires",
    "static_assert static_cast template thread_local typeid typename using virtual wchar_t",
    // Literal words
    "True False None true false null undefined nullptr NULL NaN Infinity",
  ]
    .join(" ")
    .split(" ")
);

// The words a block can contain: letters, digits, _ and $, and any letter past
// plain ASCII.
const WORD = /[A-Za-z_$À-￿][\w$À-￿]*/y;

// The other rules tried at each position, in order. A string runs to its
// closing quote, skipping backslash escapes, or to the end of the code.
const RULES: [TokenKind, RegExp][] = [
  ["pln", /\s+/y],
  ["com", /(?:#|\/\/)[^\n]*/y],
  ["com", /\/\*[\s\S]*?(?:\*\/|$)/y],
  ["str", /"(?:[^"\\]|\\[\s\S])*(?:"|\\?$)/y],
  ["str", /'(?:[^'\\]|\\[\s\S])*(?:'|\\?$)/y],
  ["str", /`(?:[^`\\]|\\[\s\S])*(?:`|\\?$)/y],
  ["lit", /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)[A-Za-z]*/y],
  ["pun", /[!%&()*+,\-./:;<=>?@[\\\]^{|}~]/y],
];

// Keywords are kwd, words that start with a capital letter are types, and the
// rest (variables, functions, builtins like print) are plain.
function wordKind(word: string): TokenKind {
  if (KEYWORDS.has(word)) return "kwd";
  if (/^\p{Lu}/u.test(word)) return "typ";
  return "pln";
}

// Adds a token, joining it to the one before when they are the same kind.
function push(tokens: Token[], kind: TokenKind, text: string) {
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind) last.text += text;
  else tokens.push({ text, kind });
}

// Splits code into tokens. Joining their text gives back the code exactly.
function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < code.length) {
    WORD.lastIndex = at;
    const word = WORD.exec(code);
    if (word) {
      push(tokens, wordKind(word[0]), word[0]);
      at += word[0].length;
      continue;
    }
    const rule = RULES.find(([, pattern]) => {
      pattern.lastIndex = at;
      return pattern.test(code) && pattern.lastIndex > at;
    });
    if (rule) {
      push(tokens, rule[0], code.slice(at, rule[1].lastIndex));
      at = rule[1].lastIndex;
    } else {
      // Anything else, like a stray backslash, is plain.
      push(tokens, "pln", code[at]);
      at += 1;
    }
  }
  return tokens;
}

// Highlighted blocks, by their code. The same lines are drawn over and over
// while blocks are dragged, so each is only split once.
const CACHE_LIMIT = 1000;
const cache = new Map<string, readonly Token[]>();

// The tokens of one block's code, for coloring with TOKEN_COLORS. Never
// throws: anything it can't split comes back as one plain token.
export function highlight(code: string): readonly Token[] {
  const text = typeof code === "string" ? code : String(code ?? "");
  const cached = cache.get(text);
  if (cached) return cached;

  let tokens: Token[];
  try {
    tokens = tokenize(text);
  } catch {
    tokens = text ? [{ text, kind: "pln" }] : [];
  }
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(text, tokens);
  return tokens;
}
