export interface OutputCheck {
  correct: boolean;
  line: number | null;
  expected: string | null;
  actual: string | null;
}

export interface CheckableRun {
  stdout: string;
  exitCode: number | null;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}

const SHOWN_LINE_LENGTH = 120;

export function outputLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function shown(line: string | undefined): string | null {
  return line === undefined ? null : line.slice(0, SHOWN_LINE_LENGTH);
}

export function checkOutput(run: CheckableRun, expectedOutput: string): OutputCheck {
  const expected = outputLines(expectedOutput);
  const actual = outputLines(run.stdout);
  const length = Math.max(expected.length, actual.length);
  for (let i = 0; i < length; i++) {
    if (expected[i] !== actual[i]) {
      return { correct: false, line: i + 1, expected: shown(expected[i]), actual: shown(actual[i]) };
    }
  }
  const ranCleanly = run.exitCode === 0 && !run.timedOut && !run.outputLimitExceeded;
  return { correct: ranCleanly, line: null, expected: null, actual: null };
}
