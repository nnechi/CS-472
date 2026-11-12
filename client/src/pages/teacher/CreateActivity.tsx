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
    parsons: "Parsons problem: students arrange code lines into correct order",
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
        <form
            className="mt-2 flex w-full flex-col text-brand"
            onSubmit={handleSubmit}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-brand/10 pb-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">Create an activity</h1>
                    <p className="text-sm text-brand/70">
                        Set up the activity, then add the questions your students will answer.
                    </p>
                </div>
                <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-brand/5 text-brand/80 hover:bg-pop/60 hover:text-brand"
                    onClick={() => navigate("/dashboard/activities")}
                    aria-label="Cancel"
                    title="Cancel"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex flex-col gap-8 py-8">
                {/* Section 1: activity details */}
                <section className="flex flex-col gap-5">
                    <h2 className="flex items-center gap-3 text-lg font-bold">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">1</span>
                        Activity details
                    </h2>

                    <div className="flex flex-col gap-5 md:flex-row">
                        <label className="flex flex-1 flex-col gap-2 text-sm font-semibold">
                            Name
                            <input
                                className="rounded-lg border border-brand/20 bg-white px-4 py-3 text-base font-normal text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-pop"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Name your activity..."
                                maxLength={ACTIVITY_NAME_MAX_LENGTH}
                                required
                            />
                        </label>

                        {type === "coding" && (
                            <label className="flex flex-col gap-2 text-sm font-semibold md:w-96">
                                Programming language
                                <div className="relative">
                                    <select
                                        className="w-full cursor-pointer appearance-none rounded-lg border border-brand/20 bg-white py-3 pl-4 pr-10 text-base font-normal text-brand focus:border-brand focus:outline-none focus:ring-2 focus:ring-pop"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}
                                        required
                                    >
                                        <option value="" disabled>Choose a language</option>
                                        {PROGRAMMING_LANGUAGES.filter((lang) => lang !== "other").map((lang) => (
                                            <option key={lang} value={lang}>{lang}</option>
                                        ))}
                                    </select>
                                    <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="m6 9 6 6 6-6" />
                                    </svg>
                                </div>
                            </label>
                        )}
                    </div>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-sm font-semibold">Activity type</legend>
                        <div className="grid gap-4 md:grid-cols-2">
                            {ACTIVITY_TYPES.map((option) => {
                                const [title, description] = TYPE_LABELS[option].split(": ")
                                return (
                                    <label
                                        key={option}
                                        className="relative flex cursor-pointer items-start gap-4 rounded-xl border border-brand/15 bg-white p-4 pr-12 hover:border-brand/40 has-[:checked]:border-2 has-[:checked]:border-brand has-[:checked]:bg-pop/25 has-[:checked]:p-[15px] has-[:checked]:pr-[47px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pop"
                                    >
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-pop/60">
                                            {option === "coding" ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
                                                </svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M3 8h11M3 13h14M3 18h7M18 9V3m0 0-2.5 2.5M18 3l2.5 2.5" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className="flex flex-col gap-1">
                                            <span className="text-base font-bold">{title}</span>
                                            <span className="text-sm text-brand/70">
                                                {description.charAt(0).toUpperCase() + description.slice(1)}.
                                            </span>
                                        </span>
                                        <input
                                            type="radio"
                                            name="activity-type"
                                            value={option}
                                            checked={type === option}
                                            onChange={() => setType(option)}
                                            className="absolute right-4 top-4 h-[18px] w-[18px] cursor-pointer accent-brand"
                                        />
                                    </label>
                                )
                            })}
                        </div>
                    </fieldset>
                </section>

                <hr className="border-brand/10" />

                {/* Section 2: questions */}
                <section className="flex flex-col gap-5">
                    <h2 className="flex items-center gap-3 text-lg font-bold">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">2</span>
                        Questions
                        <span className="rounded-full bg-pop/50 px-2.5 py-0.5 text-xs font-semibold">
                            {questions.length} {questions.length === 1 ? "question" : "questions"}
                        </span>
                    </h2>

                    <div className="flex flex-col gap-5 md:flex-row">
                        <nav aria-label="Question Navigation" className="flex flex-col gap-2 rounded-xl border border-brand/10 bg-brand/[0.03] p-3 md:relative md:w-60 md:shrink-0">
                            {/* On desktop the nav stretches to the height of the question editor,
                                so the list scrolls once it reaches the bottom of the editor. */}
                            <div className="flex flex-col gap-3 md:absolute md:inset-3">
                                <div ref={listRef} className="flex max-h-80 min-h-0 flex-col gap-2 overflow-y-auto md:max-h-none">
                                {questions.map((item, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                                            index === selected
                                                ? "bg-brand text-white"
                                                : "text-brand hover:bg-pop/40"
                                        }`}
                                        onClick={() => setSelected(index)}
                                        aria-current={index === selected ? "step" : undefined}
                                    >
                                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                                            index === selected ? "bg-white text-brand" : "bg-white text-brand ring-1 ring-brand/15"
                                        }`}>
                                            {index + 1}
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="text-sm font-bold">Question {index + 1}</span>
                                            <span className={`truncate text-xs ${index === selected ? "text-white/80" : "text-brand/60"}`}>
                                                {item.question.trim() || "Not written yet"}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                                </div>

                                <button
                                    type="button"
                                    className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-brand/40 px-3 py-2.5 text-sm font-semibold text-brand hover:bg-pop/40 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={addQuestion}
                                    disabled={questions.length >= ACTIVITY_MAX_QUESTIONS}
                                    aria-label="Add another question"
                                >
                                    <span aria-hidden="true" className="text-base leading-none">+</span>
                                    Question
                                </button>
                            </div>
                        </nav>

                        {current && (
                            <section className="flex min-w-0 flex-1 flex-col gap-5 rounded-xl border border-brand/10 bg-white p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <h3 className="text-xl font-bold">Question {selected + 1}</h3>
                                    {questions.length > 1 && (
                                        <button
                                            type="button"
                                            className="cursor-pointer rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                                            onClick={() => removeQuestion(selected)}
                                        >
                                            Remove question
                                        </button>
                                    )}
                                </div>

                                <label className="flex flex-col gap-2 text-sm font-semibold">
                                    Question
                                    <textarea
                                        className="h-32 resize-none overflow-y-auto rounded-lg border border-brand/20 p-4 text-base font-normal text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-pop"
                                        value={current.question}
                                        onChange={(e) => updateQuestion(selected, { question: e.target.value })}
                                        placeholder={type === "coding" ? "Write the programming challenge..." : "Write what the finished code should do..."}
                                        maxLength={ACTIVITY_MAX_LENGTH}
                                        required
                                    />
                                </label>

                                {type === "coding" ? (
                                    // Styles CodingQuestion's output box as a terminal from here.
                                    // The label text is 20px tall with an 8px gap, so the box starts 28px down.
                                    <div className="relative [&_label]:gap-2 [&_label]:text-sm [&_label]:font-semibold [&_label]:text-brand [&_textarea]:min-h-40 [&_textarea]:rounded-lg [&_textarea]:border-0 [&_textarea]:bg-[#16113f] [&_textarea]:px-4 [&_textarea]:pb-4 [&_textarea]:pt-14 [&_textarea]:font-mono [&_textarea]:text-sm [&_textarea]:text-white [&_textarea::placeholder]:text-white/40 [&_textarea:focus]:ring-2 [&_textarea:focus]:ring-pop">
                                        <span className="pointer-events-none absolute right-0 top-0 text-xs text-brand/70">
                                            Exactly what the program should print
                                        </span>
                                        <div className="pointer-events-none absolute inset-x-0 top-7 flex items-center gap-2 rounded-t-lg border-b border-white/10 bg-[#221a55] px-4 py-2 font-mono text-xs text-white/90">
                                            <span aria-hidden="true">&gt;_</span> output
                                        </div>
                                        <CodingQuestion
                                            item={current}
                                            onChange={(changes) => updateQuestion(selected, changes)}
                                        />
                                    </div>
                                ) : (
                                    <ParsonsQuestion
                                        item={current}
                                        onChange={(changes) => updateQuestion(selected, changes)}
                                        onSettingsChange={(changes) => updateSettings(selected, changes)}
                                        onUploadCode={uploadCode}
                                    />
                                )}
                            </section>
                        )}
                    </div>
                </section>

                {error && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </p>
                )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse items-stretch gap-4 border-t border-brand/10 py-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-brand/70">
                    {TYPE_LABELS[type].split(":")[0]} · {questions.length} {questions.length === 1 ? "question" : "questions"}
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        className="cursor-pointer rounded-lg border border-brand/20 bg-white px-6 py-3 font-semibold text-brand hover:bg-pop/40"
                        onClick={() => navigate("/dashboard/activities")}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="cursor-pointer rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save activity"}
                    </button>
                </div>
            </div>
        </form>
    )
}
