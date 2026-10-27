import { AnswerProgress, RoomActivity } from "../../types";
import LineBox, { ANSWER_FRAME_STYLE, lineStates } from "./LineBox";

interface TeacherActivityProps {
  // "Activity" in the group chat, or the student's name in their private chat.
  title: string;
  activity: RoomActivity | null;
  // Set in a private chat: the student's arrangement and results for each question.
  progress?: AnswerProgress;
}

const DEFAULT_X_INDENT = 50;

// The teacher's view of the activity, with every question whatever its type.
// Shows the answers as boxes, and in a private chat the student's work colored
// the way the student sees it.
export default function TeacherActivity({ title, activity, progress }: TeacherActivityProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold">{title}</h2>

      {!activity || activity.questions.length === 0 ? (
        <p className="text-gray-500">This room has no activity.</p>
      ) : (
        activity.questions.map((question, index) => {
          const answer = progress?.answers[index] ?? [];
          const result = progress?.results[index] ?? null;
          const marks = progress?.marks?.[index] ?? null;
          const xIndent = question.options?.xIndent ?? DEFAULT_X_INDENT;
          const answerFrame = result === true ? "correct" : result === false ? "incorrect" : "neutral";
          const states = lineStates(result, marks, answer.length);

          return (
            <article key={index} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
              <header className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">Question {index + 1}</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                  {activity.type === "parsons" ? "Parsons problem" : "Coding"}
                </span>
              </header>

              <p className="whitespace-pre-wrap">{question.question}</p>

              {activity.type === "coding" ? (
                <div>
                  <h3 className="text-xs font-semibold text-gray-600">Correct output</h3>
                  <pre className="whitespace-pre overflow-x-auto rounded-md bg-gray-50 p-2 font-mono text-sm">{question.output}</pre>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600">Solution, in order</h3>
                    <div className="px-2 pb-2" style={ANSWER_FRAME_STYLE.neutral}>
                      {(question.solution ?? []).map((line, i) => (
                        <LineBox key={i} code={line.code} indent={line.indent} xIndent={xIndent} />
                      ))}
                    </div>
                  </div>

                  {(question.distractors?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-600">Extra lines (not in the answer)</h3>
                      <div className="px-2 pb-2" style={ANSWER_FRAME_STYLE.neutral}>
                        {(question.distractors ?? []).map((code, i) => (
                          <LineBox key={i} code={code} indent={0} xIndent={xIndent} />
                        ))}
                      </div>
                    </div>
                  )}

                  {progress && (
                    <div>
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                        Student's answer
                        {result === true && <span className="text-green-700">Correct</span>}
                        {result === false && <span className="text-red-600">Incorrect</span>}
                        {result === null && <span className="font-normal text-gray-500">Not checked yet</span>}
                      </h3>
                      <div className="px-2 pb-2" style={ANSWER_FRAME_STYLE[answerFrame]}>
                        {answer.length === 0 && <p className="p-2 text-sm text-gray-500">No lines placed yet.</p>}
                        {answer.map((line, i) => (
                          <LineBox key={i} code={line.code} indent={line.indent} xIndent={xIndent} state={states[i]} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}
