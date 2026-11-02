import { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { LineMark } from "../../types";

// How one line of a Parsons problem is shown. The names and colors are the
// ones the js-parsons stylesheet uses (parsons.css).
export type LineState = "plain" | "correctPosition" | "incorrectPosition" | "incorrectIndent";

const BOX_STYLE: Record<LineState, CSSProperties> = {
  plain: { background: "#EFEFEF", border: "1px solid lightgray" },
  correctPosition: { background: "#DFF2BF", border: "1px solid green" },
  incorrectPosition: { background: "#FFBABA", border: "1px solid red" },
  incorrectIndent: { background: "#EFEFEF", border: "1px solid red", borderLeft: "10px solid red" },
};

// The most a line's box can move right, so deep indents stay on screen.
const MAX_INDENT_PX = 240;

interface LineBoxProps {
  code: string;
  indent: number;
  // Pixels per indent level. The box moves; the code inside it doesn't.
  xIndent: number;
  state?: LineState;
  // Buttons or other controls shown on the right of the line.
  children?: ReactNode;
  // Drag handlers and other props for an interactive line.
  boxProps?: HTMLAttributes<HTMLDivElement>;
}

// One line of code in a box, as js-parsons draws it: rounded, monospace, and
// shifted right by its indent level.
export default function LineBox({ code, indent, xIndent, state = "plain", children, boxProps }: LineBoxProps) {
  return (
    <div
      {...boxProps}
      className={`flex items-center gap-2 rounded-[10px] p-[10px] font-mono text-[120%] ${boxProps?.className ?? ""}`}
      style={{
        ...BOX_STYLE[state],
        marginTop: 5,
        marginLeft: Math.min(indent * xIndent, MAX_INDENT_PX),
        whiteSpace: "pre",
        overflow: "hidden",
        ...boxProps?.style,
      }}
    >
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis">{code}</span>
      {children}
    </div>
  );
}

// The state of each line of an answer after it was checked. When the whole
// answer is right, every line is green, as the library does. Otherwise only
// the marked lines are colored, and the rest stay plain.
export function lineStates(result: boolean | null, marks: LineMark[] | null, count: number): LineState[] {
  if (result === true) return Array.from({ length: count }, () => "correctPosition")
  const states: LineState[] = Array.from({ length: count }, () => "plain")
  for (const mark of marks ?? []) {
    if (mark.index < count) states[mark.index] = mark.kind === "position" ? "incorrectPosition" : "incorrectIndent"
  }
  return states
}

// The frame around an answer. Its color shows whether the whole answer is right,
// as the library's ul.correct and ul.incorrect do.
export const ANSWER_FRAME_STYLE: Record<"neutral" | "correct" | "incorrect", CSSProperties> = {
  neutral: { background: "#efefff", border: "1px solid #efefff", paddingBottom: 10 },
  correct: { background: "#DFF2BF", border: "1px solid #DFF2BF", paddingBottom: 10 },
  incorrect: { background: "#ffefef", border: "1px solid red", paddingBottom: 10 },
};
