// Activity language is the only selector. C++ uses the toolchain's canonical id.
export const BROWSER_LANGUAGES = {
  python: { language: "python", entry: "main.py" },
  javascript: { language: "javascript", entry: "main.js" },
  typescript: { language: "typescript", entry: "main.ts" },
  java: { language: "java", entry: "Main.java" },
  c: { language: "c", entry: "main.c" },
  "c++": { language: "cpp", entry: "main.cpp" },
} as const;

export function browserLanguage(language: string | null | undefined) {
  return language && Object.prototype.hasOwnProperty.call(BROWSER_LANGUAGES, language)
    ? BROWSER_LANGUAGES[language as keyof typeof BROWSER_LANGUAGES] : null;
}
