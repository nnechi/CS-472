import { DragEvent, useRef } from "react";
import { AnswerFeedback, ParsonsDisplayOptions, ParsonsLine } from "../../types";
import LineBox, { ANSWER_FRAME_STYLE, lineStates } from "./LineBox";

interface ParsonsProblemProps {
  // Every line the student can use: the solution's lines and any extra lines, shuffled.
  lines: string[];
  // The student's answer, top to bottom, with each line's indent level.
  answer: ParsonsLine[];
  options: ParsonsDisplayOptions;
  // null until the student checks, then whether the answer is right.
  result: boolean | null;
  feedback: AnswerFeedback | null;
  onChange: (answer: ParsonsLine[]) => void;
  onCheck: () => void;
  onReset: () => void;
}

// Lines the student hasn't used yet, in their shuffled order. A line that
// appears twice in the lines is only used up once per copy in the answer.
export function unusedLines(lines: string[], answer: ParsonsLine[]): string[] {
  const left = [...lines];
  for (const line of answer) {
    const at = left.indexOf(line.code);
    if (at !== -1) left.splice(at, 1);
  }
  return left;
}

// Where a dragged line came from: the trash area, or a line in the answer.
type DragSource = { from: "trash"; index: number } | { from: "answer"; index: number };

const smallButton =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 cursor-pointer hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40";

// The Parsons problem as the repo's widget runs it: lines are dragged from the
// trash area into the answer and reordered there, indented when that is on,
// and checked for feedback. The buttons do the same things without a mouse.
export default function ParsonsProblem({
  lines,
  answer,
  options,
  result,
  feedback,
  onChange,
  onCheck,
  onReset,
}: ParsonsProblemProps) {
  const dragging = useRef<DragSource | null>(null);
  // With dragging not required, every line starts in the answer and can't be removed.
  const trash = options.requireDragging ? unusedLines(lines, answer) : [];
  const states = lineStates(result, feedback?.marks ?? null, answer.length);
  const answerFrame = result === true ? "correct" : result === false ? "incorrect" : "neutral";

  // Puts a line at position `to` in the answer, from wherever it was dragged.
  function dropInAnswer(to: number) {
    return (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const source = dragging.current;
      dragging.current = null;
      if (!source) return;

      const next = [...answer];
      if (source.from === "answer") {
        const [moved] = next.splice(source.index, 1);
        next.splice(source.index < to ? to - 1 : to, 0, moved);
      } else {
        const code = trash[source.index];
        if (code === undefined) return;
        next.splice(to, 0, { code, indent: 0 });
      }
      onChange(next);
    };
  }

  // Dropping a line on the trash area takes it out of the answer.
  function dropInTrash(event: DragEvent) {
    event.preventDefault();
    const source = dragging.current;
    dragging.current = null;
    if (source?.from !== "answer") return;
    onChange(answer.filter((_, i) => i !== source.index));
  }

  function moveLine(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= answer.length) return;
    const next = [...answer];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function changeIndent(index: number, by: number) {
    onChange(
      answer.map((line, i) => (i === index ? { ...line, indent: Math.max(0, line.indent + by) } : line))
    );
  }

  const dragHandlers = (source: DragSource) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      dragging.current = source;
      event.dataTransfer.setData("text/plain", "");
    },
    onDragEnd: () => {
      dragging.current = null;
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {options.requireDragging && (
        <section aria-label="Lines to drag" onDragOver={(e) => e.preventDefault()} onDrop={dropInTrash}>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Lines</h3>
          <div className="min-h-16 rounded-md px-2 pb-2" style={{ background: "#efefff", border: "1px solid #efefff" }}>
            {trash.length === 0 ? (
              <p className="p-2 text-sm text-gray-500">Every line is in your answer.</p>
            ) : (
              trash.map((code, index) => (
                <LineBox
                  key={index}
                  code={code}
                  indent={0}
                  xIndent={options.xIndent}
                  boxProps={{ ...dragHandlers({ from: "trash", index }), className: "cursor-move" }}
                >
                  <button type="button" className={smallButton} onClick={() => onChange([...answer, { code, indent: 0 }])}>
                    Add
                  </button>
                </LineBox>
              ))
            )}
          </div>
        </section>
      )}

      <section aria-label="Your answer">
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Your answer</h3>
        <div
          className="min-h-16 px-2"
          style={ANSWER_FRAME_STYLE[answerFrame]}
          onDragOver={(e) => e.preventDefault()}
          onDrop={dropInAnswer(answer.length)}
        >
          {answer.length === 0 && (
            <p className="p-2 text-sm text-gray-500">
              {options.requireDragging ? "Drag lines here to build your answer." : "Your lines will appear here."}
            </p>
          )}
          {answer.map((line, index) => (
            <LineBox
              key={index}
              code={line.code}
              indent={line.indent}
              xIndent={options.xIndent}
              state={states[index]}
              boxProps={{
                ...dragHandlers({ from: "answer", index }),
                onDragOver: (e) => e.preventDefault(),
                onDrop: dropInAnswer(index),
                className: "cursor-move",
              }}
            >
              <button type="button" className={smallButton} aria-label="Move line up" disabled={index === 0} onClick={() => moveLine(index, -1)}>
                ↑
              </button>
              <button
                type="button"
                className={smallButton}
                aria-label="Move line down"
                disabled={index === answer.length - 1}
                onClick={() => moveLine(index, 1)}
              >
                ↓
              </button>
              {options.canIndent && (
                <>
                  <button type="button" className={smallButton} aria-label="Outdent line" disabled={line.indent === 0} onClick={() => changeIndent(index, -1)}>
                    ←
                  </button>
                  <button type="button" className={smallButton} aria-label="Indent line" onClick={() => changeIndent(index, 1)}>
                    →
                  </button>
                </>
              )}
              {options.requireDragging && (
                <button
                  type="button"
                  className={smallButton}
                  aria-label="Remove line"
                  onClick={() => onChange(answer.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              )}
            </LineBox>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={answer.length === 0}
          onClick={onCheck}
        >
          Get Feedback
        </button>
        <button
          type="button"
          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
          onClick={onReset}
        >
          Reset Problem
        </button>
        {result === true && <span className="font-semibold text-green-700">Correct!</span>}
        {result === false && options.showFeedback && feedback && feedback.errors.length > 0 && (
          <ul className="w-full list-disc pl-6 text-sm text-red-700">
            {feedback.errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        )}
        {result === false && !(options.showFeedback && feedback && feedback.errors.length > 0) && (
          <span className="font-semibold text-red-600">Not quite. Keep trying.</span>
        )}
      </div>
    </div>
  );
}
