import { AnswerFeedback, ParsonsLine, RoomActivity } from "../../types";
import ParsonsProblem from "./ParsonsProblem";

interface StudentActivityProps {
  activity: RoomActivity | null;
  // The question the teacher picked. Students can't change it.
  currentQuestion: number;
  // The student's arrangement of each Parsons question, each question's result,
  // and the feedback for each.
  answers: ParsonsLine[][];
  results: (boolean | null)[];
  feedback: (AnswerFeedback | null)[];
  onChange: (questionIndex: number, lines: ParsonsLine[]) => void;
  onCheck: (questionIndex: number) => void;
  onReset: (questionIndex: number) => void;
}

// The activity as a student sees it: the question the teacher picked. Parsons
// questions are solved in place. Coding questions show their text.
export default function StudentActivity({
  activity,
  currentQuestion,
  answers,
  results,
  feedback,
  onChange,
  onCheck,
  onReset,
}: StudentActivityProps) {
  if (!activity || activity.questions.length === 0) {
    return (
      <section className="flex flex-1 flex-col p-4">
        {/* <h2 className="mb-2 text-sm font-semibold">Activity</h2> */}
        <p className="text-gray-500">Your teacher hasn't picked an activity yet.</p>
      </section>
    );
  }

  const index = Math.min(currentQuestion, activity.questions.length - 1);
  const question = activity.questions[index];

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      {/* <h2 className="text-sm font-semibold">Activity</h2> */}

      <p className="text-sm font-semibold">
        Question {index + 1} of {activity.questions.length}
      </p>

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
