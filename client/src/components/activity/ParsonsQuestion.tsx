import { ChangeEvent } from "react"
import { ActivityQuestion, ParsonsSettings } from "../../types"
import { codeLines, effectiveRequireDragging, UPLOAD_LIMIT } from "./questionCode"

// The graders from the generator. Only the line based one runs without Python in the browser.
const GRADERS : { value : string; label : string; supported : boolean }[] = [
    { value: "line-based", label: "Line based", supported: true },
    { value: "variable-check", label: "Variable check (needs Python)", supported: false },
    { value: "unit-test", label: "Unit test (needs Python)", supported: false },
    { value: "language-translation", label: "Language translation (needs Python)", supported: false },
    { value: "turtle", label: "Turtle (needs Python)", supported: false },
]

interface ParsonsQuestionProps {
    item : ActivityQuestion
    onChange : (changes : Partial<ActivityQuestion>) => void
    onSettingsChange : (changes : Partial<ParsonsSettings>) => void
    onUploadCode : (event : ChangeEvent<HTMLInputElement>) => void
}

// The fields for a Parsons question: the code students put in order, the extra
// lines, and the settings that control how the problem is graded and shown.
export default function ParsonsQuestion({ item, onChange, onSettingsChange, onUploadCode } : ParsonsQuestionProps){
    const lines = codeLines(item.code).length
    const extras = codeLines(item.distractors).length

    return (
        <>
            <div className="flex flex-col gap-2 text-sm text-gray-600">
                <label className="flex flex-col gap-1">
                    Upload code (optional, or paste it below)
                    <input
                        type="file"
                        accept=".py,.js,.ts,.java,.c,.cpp,.h,.txt,text/plain"
                        onChange={onUploadCode}
                        className="text-sm"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    Code, one line per row (start a line with spaces to indent it)
                    <textarea
                        className="min-h-40 whitespace-pre rounded-lg border border-gray-300 p-3 font-mono text-sm text-black focus:border-indigo-600 focus:outline-none"
                        value={item.code}
                        onChange={(e) => onChange({ code: e.target.value })}
                        placeholder={"print(\"Hello\")\nprint(\"World\")"}
                        maxLength={UPLOAD_LIMIT}
                        spellCheck={false}
                        required
                    />
                </label>
                <label className="flex flex-col gap-1">
                    Extra lines that aren't part of the answer (optional, one per row)
                    <textarea
                        className="min-h-20 whitespace-pre rounded-lg border border-gray-300 p-3 font-mono text-sm text-black focus:border-indigo-600 focus:outline-none"
                        value={item.distractors}
                        onChange={(e) => onChange({ distractors: e.target.value })}
                        placeholder="Lines that look right but don't belong"
                        maxLength={UPLOAD_LIMIT}
                        spellCheck={false}
                    />
                </label>
            </div>

            <fieldset className="grid gap-3 rounded-lg border border-gray-300 p-3 text-sm text-gray-700 sm:grid-cols-2">
                <legend className="px-1 font-semibold">Parsons settings</legend>

                <label className="flex flex-col gap-1">
                    Max extra lines a student gets
                    <input
                        type="number"
                        min={0}
                        max={60}
                        className="rounded-md border border-gray-300 px-2 py-1 text-black"
                        value={item.settings.maxWrongLines}
                        onChange={(e) => onSettingsChange({ maxWrongLines: Number(e.target.value) })}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    Grader
                    <select
                        className="rounded-md border border-gray-300 px-2 py-1 text-black"
                        value="line-based"
                        onChange={() => undefined}
                    >
                        {GRADERS.map((grader) => (
                            <option key={grader.value} value={grader.value} disabled={!grader.supported}>
                                {grader.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={effectiveRequireDragging(item)}
                        disabled={extras > 0 && item.settings.maxWrongLines > 0}
                        onChange={(e) => onSettingsChange({ requireDragging: e.target.checked })}
                    />
                    Require dragging (extra lines start in a trash area)
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={!item.settings.canIndent}
                        onChange={(e) => onSettingsChange({ canIndent: !e.target.checked })}
                    />
                    Disable indentation
                </label>

                <label className="flex flex-col gap-1">
                    Indent size (pixels)
                    <input
                        type="number"
                        min={1}
                        max={500}
                        disabled={!item.settings.canIndent}
                        className="rounded-md border border-gray-300 px-2 py-1 text-black disabled:bg-gray-100"
                        value={item.settings.xIndent}
                        onChange={(e) => onSettingsChange({ xIndent: Number(e.target.value) })}
                    />
                </label>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={item.settings.showFeedback}
                        onChange={(e) => onSettingsChange({ showFeedback: e.target.checked })}
                    />
                    Show feedback to students
                </label>

                <label className="flex flex-col gap-1 sm:col-span-2">
                    Execution limit (milliseconds, used by graders that run code)
                    <input
                        type="number"
                        min={100}
                        max={60000}
                        className="rounded-md border border-gray-300 px-2 py-1 text-black sm:w-40"
                        value={item.settings.execLimit}
                        onChange={(e) => onSettingsChange({ execLimit: Number(e.target.value) })}
                    />
                </label>
            </fieldset>

            <p className="text-sm text-gray-500">
                {lines === 0
                    ? "Add code to see what students will get."
                    : `Students get ${lines} line${lines === 1 ? "" : "s"} of code, plus up to ${Math.min(item.settings.maxWrongLines, extras)} of ${extras} extra line${extras === 1 ? "" : "s"}, in a random order.`}
            </p>
        </>
    )
}
