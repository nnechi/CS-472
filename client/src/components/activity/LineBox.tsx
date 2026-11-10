import { CSSProperties, ComponentPropsWithRef, Fragment, HTMLAttributes, ReactNode, forwardRef, memo } from "react";
import { LineMark } from "../../types";
import { TOKEN_COLORS, highlight } from "./highlight";
import { indentOffsetPx } from "./parsonsDrag";

// How one line of a Parsons problem is shown. The names and colors are the
// ones the js-parsons stylesheet uses (parsons.css).
export type LineState = "plain" | "correctPosition" | "incorrectPosition" | "incorrectIndent";

// Every state sets the same properties, so switching between them never
// leaves a border behind.
const BOX_STYLE: Record<LineState, CSSProperties> = {
  plain: { backgroundColor: "#EFEFEF", borderStyle: "solid", borderColor: "lightgray", borderWidth: 1 },
  correctPosition: { backgroundColor: "#DFF2BF", borderStyle: "solid", borderColor: "green", borderWidth: 1 },
  incorrectPosition: { backgroundColor: "#FFBABA", borderStyle: "solid", borderColor: "red", borderWidth: 1 },
  incorrectIndent: { backgroundColor: "#EFEFEF", borderStyle: "solid", borderColor: "red", borderWidth: "1px 1px 1px 10px" },
};

// A block can be raised off the page: "lifted" while it is held from the
// keyboard, "ghost" for the copy that follows the pointer during a drag.
export type LineLook = "flat" | "lifted" | "ghost";

const LOOK_STYLE: Record<LineLook, CSSProperties> = {
  flat: {},
  lifted: { boxShadow: "0 0 0 3px #221574, 0 8px 18px rgba(0, 0, 0, 0.25)" },
  ghost: { boxShadow: "0 12px 28px rgba(0, 0, 0, 0.3)", opacity: 0.95 },
};

interface LineBoxProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  code: string;
  indent: number;
  // Pixels per indent level. The box moves; the code inside it doesn't.
  xIndent: number;
  state?: LineState;
  look?: LineLook;
  // Props for the element around the code. The student's widget makes it the
  // block's drag handle.
  codeProps?: ComponentPropsWithRef<"div">;
  // Controls drawn over the right end of the line, like the widget's toolbar.
  children?: ReactNode;
}

// The code split into prettify's tokens, each in its color.
const HighlightedCode = memo(function HighlightedCode({ code }: { code: string }) {
  return (
    <code>
      {highlight(code).map((token, i) =>
        token.kind === "pln" ? (
          <Fragment key={i}>{token.text}</Fragment>
        ) : (
          <span key={i} style={{ color: TOKEN_COLORS[token.kind] }}>
            {token.text}
          </span>
        )
      )}
    </code>
  );
});

// One line of code in a box, as js-parsons draws it: rounded, monospace,
// syntax highlighted, and shifted right by its indent level. Long code is cut
// off at the edge; the title shows all of it.
const LineBox = memo(
  forwardRef<HTMLDivElement, LineBoxProps>(function LineBox(
    { code, indent, xIndent, state = "plain", look = "flat", codeProps, children, className = "", style, ...rest },
    ref
  ) {
    return (
      <div
        ref={ref}
        title={code}
        {...rest}
        className={`relative rounded-[10px] font-mono text-[120%] ${className}`}
        style={{
          ...BOX_STYLE[state],
          ...LOOK_STYLE[look],
          color: "#000",
          marginTop: 5,
          marginLeft: indentOffsetPx(indent, xIndent),
          ...style,
        }}
      >
        <div {...codeProps} className={`overflow-hidden text-ellipsis whitespace-pre p-[10px] ${codeProps?.className ?? ""}`}>
          <HighlightedCode code={code} />
        </div>
        {children}
      </div>
    );
  })
);

export default LineBox;

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

// The frame around an answer, js-parsons' solution list (ul.output). Its color
// shows whether the whole answer is right, as the library's ul.correct and
// ul.incorrect do.
export const ANSWER_FRAME_STYLE: Record<"neutral" | "correct" | "incorrect", CSSProperties> = {
  neutral: { backgroundColor: "#FFFFAA", border: "1px solid #efefff", paddingBottom: 10 },
  correct: { backgroundColor: "#DFF2BF", border: "1px solid #DFF2BF", paddingBottom: 10 },
  incorrect: { backgroundColor: "#ffefef", border: "1px solid red", paddingBottom: 10 },
};

// The frame around the blocks still to be placed, js-parsons' trash list.
export const TRASH_FRAME_STYLE: CSSProperties = {
  backgroundColor: "#efefff",
  border: "1px solid #efefff",
  paddingBottom: 10,
};
