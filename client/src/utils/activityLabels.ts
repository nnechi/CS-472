import type { RoomActivity } from "../types";

// How each stored language name is shown to people.
const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python",
  "c++": "C++",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  c: "C",
};

// The language of a coding activity, as shown to people. Null for Parsons
// (no language) and for "other" or unset, since there's nothing useful to show.
export function activityLanguageLabel(activity: Pick<RoomActivity, "type" | "language">): string | null {
  if (activity.type !== "coding" || !activity.language) return null;
  return LANGUAGE_LABELS[activity.language] ?? null;
}
