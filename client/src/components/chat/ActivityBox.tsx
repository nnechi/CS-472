import { ACTIVITY_MAX_LENGTH } from "../../types";

interface ActivityBoxProps {
  title: string;
  text: string;
  // Teachers read the activity. Students write in their own copy.
  readOnly?: boolean;
  onChange?: (text: string) => void;
}

// The activity students work on. Shows the text box for the chat currently open.
export default function ActivityBox({ title, text, readOnly = false, onChange }: ActivityBoxProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <textarea
        className="min-h-48 flex-1 resize-none rounded-lg border border-gray-300 p-3 text-base focus:border-indigo-600 focus:outline-none read-only:bg-gray-50"
        aria-label={title}
        value={text}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={readOnly ? "No activity yet." : "Work on the activity here..."}
        maxLength={ACTIVITY_MAX_LENGTH}
      />
    </section>
  );
}
