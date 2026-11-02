import { ACTIVITY_MAX_LENGTH, ActivityQuestion } from "../../types"

// The most code a teacher can upload for one question, in characters.
export const UPLOAD_LIMIT = ACTIVITY_MAX_LENGTH * 10

// The lines of code a teacher typed or uploaded. Blank lines are dropped here,
// as the generator does. Indentation is kept.
export function codeLines(text : string) : string[] {
    return text.split("\n").filter((line) => line.trim() !== "")
}

// Extra lines need dragging to be solvable, so the generator turns it on for them.
export function effectiveRequireDragging(item : ActivityQuestion) : boolean {
    const hasExtraLines = codeLines(item.distractors).length > 0
    return item.settings.requireDragging || (hasExtraLines && item.settings.maxWrongLines > 0)
}
