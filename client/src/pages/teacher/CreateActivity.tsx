import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ActivityInput, ActivityQuestionInput, createActivity } from "../../api"
import CodingQuestion from "../../components/activity/CodingQuestion"
import ParsonsQuestion from "../../components/activity/ParsonsQuestion"
import { codeLines, effectiveRequireDragging, UPLOAD_LIMIT } from "../../components/activity/questionCode"
import useAuth from "../../hooks/useAuth"
import {
    ACTIVITY_MAX_LENGTH,
    ACTIVITY_MAX_QUESTIONS,
    ACTIVITY_NAME_MAX_LENGTH,
    ACTIVITY_TYPES,
    ActivityQuestion,
    ActivityType,
    DEFAULT_PARSONS_SETTINGS,
    ParsonsSettings,
    PROGRAMMING_LANGUAGES,
    ProgrammingLanguage,
} from "../../types"

const EMPTY_QUESTION : ActivityQuestion = {
    question: "",
    output: "",
    code: "",
    distractors: "",
    settings: DEFAULT_PARSONS_SETTINGS,
}

const TYPE_LABELS : Record<ActivityType, string> = {
    coding: "Coding: students write code that prints the output",
    parsons: "Parsons problem: students put the lines in the right order",
}

// What the server receives for one question, for the activity's type.
function questionInput(type : ActivityType, item : ActivityQuestion) : ActivityQuestionInput {
    if (type === "coding") return { question: item.question.trim(), output: item.output }
    return {
        question: item.question.trim(),
        code: codeLines(item.code).join("\n"),
        distractors: codeLines(item.distractors).join("\n"),
        options: item.settings,
    }
}

// /dashboard/create-activity -- a teacher writes an activity and saves it under
// their account. Only that teacher can use it in their rooms. An activity is
// coding or a Parsons problem, and each of its questions is that type.
export default function CreateActivity(){
    const navigate = useNavigate()
    const { auth } = useAuth()
    const [name, setName] = useState("")
    const [type, setType] = useState<ActivityType>("coding")
    const [language, setLanguage] = useState<ProgrammingLanguage | "">("")
    const [questions, setQuestions] = useState<ActivityQuestion[]>([EMPTY_QUESTION])
    const [selected, setSelected] = useState(0)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const listRef = useRef<HTMLDivElement>(null)

    // Keep the highlighted question visible in the scrolling list, e.g. after
    // "+ Question" adds one past the bottom.
    useEffect(() => {
        const item = listRef.current?.children[selected] as HTMLElement | undefined
        item?.scrollIntoView({ block: "nearest" })
    }, [selected, questions.length])

    function updateQuestion(index : number, changes : Partial<ActivityQuestion>){
        setQuestions((current) => current.map((item, i) => i === index ? { ...item, ...changes } : item))
    }

    function updateSettings(index : number, changes : Partial<ParsonsSettings>){
        setQuestions((current) => current.map((item, i) =>
            i === index ? { ...item, settings: { ...item.settings, ...changes } } : item))
    }

    // Reads a code file into the question's code box. The teacher can still edit it.
    async function uploadCode(event : ChangeEvent<HTMLInputElement>){
        const file = event.target.files?.[0]
        event.target.value = ""
        if (!file) return
        if (file.size > UPLOAD_LIMIT) {
            setError(`That file is too large. Upload code under ${UPLOAD_LIMIT} characters.`)
            return
        }
        const text = await file.text()
        setError("")
        updateQuestion(selected, { code: text.replace(/\r\n?/g, "\n") })
    }

    function addQuestion(){
        if (questions.length >= ACTIVITY_MAX_QUESTIONS) return
        setQuestions((current) => [...current, EMPTY_QUESTION])
        setSelected(questions.length)
    }

    function removeQuestion(index : number){
        // Keep the same question highlighted when an earlier one is removed,
        // and step back when the last one is removed.
        if (index < selected || (index === selected && selected === questions.length - 1)) {
            setSelected(selected - 1)
        }
        setQuestions((current) => current.filter((_, i) => i !== index))
    }

    async function handleSubmit(e : FormEvent){
        e.preventDefault()
        if (!auth || saving) return
        if (type === "coding" && !language) {
            setError("Choose a programming language.")
            return
        }
        const activity : ActivityInput = {
            name,
            type,
            language: type === "coding" && language ? language : null,
            questions: questions.map((item) => questionInput(type, {
                ...item,
                settings: { ...item.settings, requireDragging: effectiveRequireDragging(item) },
            })),
        }
        setSaving(true)
        setError("")
        try {
            await createActivity(auth.user.id, activity)
            navigate("/dashboard/activities")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the activity.")
            setSaving(false)
        }
    }

    const current = questions[selected]

    return (
        <form className="mt-8 flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-4">
                <h1 className="text-4xl font-bold">Create an activity</h1>
                <button
                    type="button"
                    className="rounded-lg px-2 text-3xl leading-none text-gray-600 cursor-pointer hover:bg-neutral-100 hover:text-black"
                    onClick={() => navigate("/dashboard")}
                    aria-label="Cancel"
                    title="Cancel"
                >
                    ×
                </button>
            </div>

            <label className="flex flex-col gap-1 text-sm text-gray-600">
                Name
                <input
                    className="rounded-lg border border-gray-300 px-3 py-2 text-base text-black focus:border-indigo-600 focus:outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name your activity..."
                    maxLength={ACTIVITY_NAME_MAX_LENGTH}
                    required
                />
            </label>

            <fieldset className="flex flex-col gap-2 text-sm text-gray-600">
                <legend className="mb-1">Activity type</legend>
                {ACTIVITY_TYPES.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 text-base text-black has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                        <input
                            type="radio"
                            name="activity-type"
                            value={option}
                            checked={type === option}
                            onChange={() => setType(option)}
                        />
                        {TYPE_LABELS[option]}
                    </label>
                ))}
            </fieldset>

            {type === "coding" && (
                <label className="flex flex-col gap-1 text-sm text-gray-600">
                    Programming language
                    <select
                        className="rounded-lg border border-gray-300 px-3 py-2 text-base text-black focus:border-indigo-600 focus:outline-none"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}
                        required
                    >
                        <option value="" disabled>Choose a language</option>
                        {PROGRAMMING_LANGUAGES.map((lang) => (
                            <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </select>
                </label>
            )}

            <div className="flex flex-col gap-6 md:flex-row">
                <nav  aria-label="Question Navigation" className="flex flex-col gap-2 rounded-lg border border-gray-300 p-3 md:relative md:w-56 md:shrink-0">
                    {/* On desktop the nav stretches to the height of the question editor,
                        so the list scrolls once it reaches the bottom of the editor. */}
                    <div className="flex flex-col gap-2 md:absolute md:inset-3">
                        <div ref={listRef} className="flex max-h-80 min-h-0 flex-1 flex-col gap-2 overflow-y-auto md:max-h-none">
                        {questions.map((_, index) => (
                            <button
                                key={index}
                                type="button"
                                className={`rounded-lg px-3 py-2 text-left text-base cursor-pointer ${
                                    index === selected
                                        ? "bg-neutral-900 text-white"
                                        : "text-gray-900 hover:bg-neutral-100"
                                }`}
                                onClick={() => setSelected(index)}
                                aria-current={index === selected ? "step" : undefined}
                            >
                                Question {index + 1}
                            </button>
                        ))}
                        </div>

                        <button
                            type="button"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-left text-base text-gray-900 cursor-pointer hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={addQuestion}
                            disabled={questions.length >= ACTIVITY_MAX_QUESTIONS}
                            aria-label="Add another question"
                        >
                            + Question
                        </button>
                    </div>
                </nav>

                {current && (
                    <section className="flex flex-1 flex-col gap-4">
                        <h2 className="text-xl font-semibold">Question {selected + 1}</h2>

                        <label className="flex flex-col gap-1 text-sm text-gray-600">
                            Question
                            <textarea
                                className="h-32 resize-none overflow-y-auto rounded-lg border border-gray-300 p-3 text-base text-black focus:border-indigo-600 focus:outline-none"
                                value={current.question}
                                onChange={(e) => updateQuestion(selected, { question: e.target.value })}
                                placeholder={type === "coding" ? "Write the programming challenge..." : "Write what the finished code should do..."}
                                maxLength={ACTIVITY_MAX_LENGTH}
                                required
                            />
                        </label>

                        {type === "coding" ? (
                            <CodingQuestion
                                item={current}
                                onChange={(changes) => updateQuestion(selected, changes)}
                            />
                        ) : (
                            <ParsonsQuestion
                                item={current}
                                onChange={(changes) => updateQuestion(selected, changes)}
                                onSettingsChange={(changes) => updateSettings(selected, changes)}
                                onUploadCode={uploadCode}
                            />
                        )}

                        {questions.length > 1 && (
                            <button
                                type="button"
                                className="self-start text-sm text-red-600 cursor-pointer hover:underline"
                                onClick={() => removeQuestion(selected)}
                            >
                                Remove question
                            </button>
                        )}
                    </section>
                )}
            </div>

            {error && <p role="alert" className="text-red-600">{error}</p>}

            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                    onClick={() => navigate("/dashboard")}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={saving}
                >
                    {saving ? "Saving..." : "Save activity"}
                </button>
            </div>
        </form>
    )
}
