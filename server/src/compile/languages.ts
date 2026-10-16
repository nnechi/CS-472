import { CompileLanguage, LanguageSpec } from "./types";

// Commands and filenames are fixed here. Never interpolate user input into a
// shell command or accept an executable or filename from the client.
// Each command is intended to run with cwd set to a fresh job directory.
export const LANGUAGE_SPECS: Readonly<Record<CompileLanguage, LanguageSpec>> = {
  javascript: {
    sourceFile: "main.js",
    run: { executable: "node", args: ["main.js"] },
  },
  typescript: {
    sourceFile: "main.ts",
    compile: {
      executable: "tsc",
      args: [
        "main.ts",
        "--outDir", "build",
        "--module", "commonjs",
        "--target", "ES2022",
        "--skipLibCheck",
      ],
    },
    run: { executable: "node", args: ["build/main.js"] },
  },
  c: {
    sourceFile: "main.c",
    compile: { executable: "gcc", args: ["main.c", "-o", "program"] },
    run: { executable: "./program", args: [] },
  },
  cpp: {
    sourceFile: "main.cpp",
    compile: {
      executable: "g++",
      args: ["main.cpp", "-std=c++17", "-o", "program"],
    },
    run: { executable: "./program", args: [] },
  },
  java: {
    // Java submissions should declare a Main class.
    sourceFile: "Main.java",
    compile: { executable: "javac", args: ["Main.java"] },
    run: { executable: "java", args: ["-cp", ".", "Main"] },
  },
  python: {
    sourceFile: "main.py",
    run: { executable: "python3", args: ["-u", "main.py"] },
  },
};
