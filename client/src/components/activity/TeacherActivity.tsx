import { AnswerProgress, ParsonsLine, RoomActivity } from "../../types";

interface TeacherActivityProps {
  // "Activity" in the group chat, or the student's name in their private chat.
  title: string;
  activity: RoomActivity | null;
  // Set in a private chat: the student's arrangement and results for each question.
  progress?: AnswerProgress;
}

const codeClass = "whitespace-pre overflow-x-auto rounded-md bg-gray-50 p-2 font-mono text-sm";

// Lines as code, with four spaces per indent level, the way the student's answer is shown.
const formatLines = (lines: ParsonsLine[]) => lines.map((line) => "    ".repeat(line.indent) + line.code).join("\n");

// The teacher's view of the activity, with every question whatever its type.
// Shows the answers, and in a private chat the student's work.
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
                  <pre className={codeClass}>{question.output}</pre>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600">Solution, in order</h3>
                    <pre className={codeClass}>{formatLines(question.solution ?? [])}</pre>
                  </div>

                  {(question.distractors?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-600">Extra lines (not in the answer)</h3>
                      <pre className={codeClass}>{(question.distractors ?? []).join("\n")}</pre>
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
                      <pre className={codeClass}>
                        {answer.length > 0 ? formatLines(answer) : "No lines placed yet."}
                      </pre>
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
