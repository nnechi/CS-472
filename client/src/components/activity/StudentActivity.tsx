import { useState } from "react";
import { AnswerFeedback, ParsonsLine, RoomActivity } from "../../types";
import ParsonsProblem from "./ParsonsProblem";

interface StudentActivityProps {
  activity: RoomActivity | null;
  // The student's arrangement of each Parsons question, each question's result,
  // and the feedback for each.
  answers: ParsonsLine[][];
  results: (boolean | null)[];
  feedback: (AnswerFeedback | null)[];
  onChange: (questionIndex: number, lines: ParsonsLine[]) => void;
  onCheck: (questionIndex: number) => void;
  onReset: (questionIndex: number) => void;
}

// The activity as a student sees it: one question at a time. Parsons questions
// are solved in place. Coding questions show their text.
export default function StudentActivity({
  activity,
  answers,
  results,
  feedback,
  onChange,
  onCheck,
  onReset,
}: StudentActivityProps) {
  const [selected, setSelected] = useState(0);

  if (!activity || activity.questions.length === 0) {
    return (
      <section className="flex flex-1 flex-col p-4">
        <h2 className="mb-2 text-sm font-semibold">Activity</h2>
        <p className="text-gray-500">Your teacher hasn't picked an activity yet.</p>
      </section>
    );
  }

  const index = Math.min(selected, activity.questions.length - 1);
  const question = activity.questions[index];

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold">Activity</h2>

      <nav aria-label="Questions" className="flex flex-wrap gap-2">
        {activity.questions.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-current={i === index ? "step" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm cursor-pointer ${
              i === index ? "bg-neutral-900 text-white" : "border border-gray-300 text-gray-900 hover:bg-neutral-100"
            }`}
            onClick={() => setSelected(i)}
          >
            Question {i + 1}
            {results[i] === true && " ✓"}
          </button>
        ))}
      </nav>

      <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3">{question.question}</div>

      {activity.type === "parsons" && question.options ? (
        <ParsonsProblem
          key={index}
          lines={question.lines ?? []}
          answer={answers[index] ?? []}
          options={question.options}
          result={results[index] ?? null}
          feedback={feedback[index] ?? null}
          onChange={(lines) => onChange(index, lines)}
          onCheck={() => onCheck(index)}
          onReset={() => onReset(index)}
        />
      ) : (
        <p className="text-sm text-gray-500">Write your code for this question in your own editor.</p>
      )}
    </section>
  );
}
