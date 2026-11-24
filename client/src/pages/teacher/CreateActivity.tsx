import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ChevronDown, Code, ListOrdered, X } from "lucide-react"
import { ActivityInput, ActivityQuestionInput, createActivity, saveActivityNote } from "../../api"
import CodingQuestion from "../../components/activity/CodingQuestion"
import ParsonsQuestion from "../../components/activity/ParsonsQuestion"
import { codeLines, effectiveRequireDragging, UPLOAD_LIMIT } from "../../components/activity/questionCode"
import useAuth from "../../hooks/useAuth"
import shortLogo from "../../assets/LittlePointers Logo/Short Logo.png"
import AccountMenu from "../../components/AccountMenu"
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
    NOTE_MAX_LENGTH,
} from "../../types"

const EMPTY_QUESTION : ActivityQuestion = {
    question: "",
    output: "",
    code: "",
    distractors: "",
    settings: DEFAULT_PARSONS_SETTINGS,
}

// How each language is shown in the dropdown. The lowercase value is what gets saved.
const LANGUAGE_LABELS : Record<ProgrammingLanguage, string> = {
    python: "Python",
    "c++": "C++",
    javascript: "JavaScript",
    typescript: "TypeScript",
    java: "Java",
    c: "C",
    other: "Other",
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
    // The teacher's private notes on the activity, saved with it on Finish.
    const [notes, setNotes] = useState("")
    // Set once the activity is saved. If its notes then fail to save, Finish only retries the notes.
    const [createdId, setCreatedId] = useState<string | null>(null)
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
        let id = createdId
        try {
            if (id === null) {
                id = (await createActivity(activity)).id
                setCreatedId(id)
            }
            if (notes.trim()) await saveActivityNote(id, notes)
            navigate("/dashboard/activities")
        } catch (err) {
            const reason = err instanceof Error ? err.message : "Could not save the activity."
            setError(id === null
                ? reason
                // The activity exists now. Saving it again would make a copy, so only the notes are retried.
                : `Your activity was saved, but your notes weren't: ${reason} Click Finish to try saving them again.`)
            setSaving(false)
        }
    }

    const current = questions[selected]

    return (
        // On desktop the page is at least the window's height and grows past it when
        // needed. The questions section has a minimum height so it never gets squished.
        <div className="flex flex-col md:min-h-dvh">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-8 gap-y-3 bg-brand-light py-3 pr-4 sm:h-20 sm:py-0 sm:pr-8">
                <div className="ml-4 flex h-14 items-center gap-0 sm:ml-8">
                    {/* Short logo at every screen size. It goes back to the dashboard. */}
                    <Link to="/dashboard" aria-label="LittlePointers dashboard">
                        <img src={shortLogo} alt="" className="h-14 w-14" />
                    </Link>
                </div>

                {/* The profile picture opens a menu with Settings and Log out. */}
                <AccountMenu />
            </header>

            <form
                className="mt-6 flex w-full flex-col px-4 text-brand sm:px-8 md:min-h-0 md:flex-1"
                onSubmit={handleSubmit}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-brand/10 pb-6">
                    <div className="flex flex-col gap-3">
                        <h1 className="text-5xl font-bold tracking-tight">Create Activity</h1>
                        <p className="text-2xl text-brand/70">
                            Set up the activity, then add the questions your students will answer.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-6 py-6 md:min-h-0 md:flex-1">
                    {/* Section 1: activity details */}
                    <section className="flex flex-col gap-5">
                        <h2 className="flex items-center gap-3 text-3xl font-bold">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-2xl text-white">1</span>
                            Activity Details
                        </h2>

                        <div className="flex flex-col gap-5 md:flex-row">
                            <label className="flex flex-1 flex-col gap-2 text-2xl font-semibold">
                                Name
                                <input
                                    className="rounded-lg border border-brand/20 bg-white px-4 py-3 text-xl font-normal text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-pop"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Name your activity..."
                                    maxLength={ACTIVITY_NAME_MAX_LENGTH}
                                    required
                                />
                            </label>

                            {type === "coding" && (
                                <label className="flex flex-col gap-2 text-2xl font-semibold md:w-96">
                                    Programming Language
                                    <div className="relative">
                                        <select
                                            // appearance:base-select lets the open list use the page's font and styles
                                            // (Chrome/Edge). Other browsers ignore it and show their own menu.
                                            className="w-full cursor-pointer appearance-none rounded-lg border border-brand/20 bg-white py-3 pl-4 pr-10 text-xl font-normal text-brand focus:border-brand focus:outline-none focus:ring-2 focus:ring-pop supports-[appearance:base-select]:[appearance:base-select] [&::picker-icon]:hidden [&::picker(select)]:[appearance:base-select] [&::picker(select)]:mt-1 [&::picker(select)]:rounded-lg [&::picker(select)]:border [&::picker(select)]:border-brand/20 [&::picker(select)]:bg-white [&::picker(select)]:p-1 [&::picker(select)]:shadow-lg [&_option]:cursor-pointer [&_option]:rounded-md [&_option]:px-3 [&_option]:py-2 [&_option]:text-xl [&_option]:text-brand [&_option:checked]:bg-pop/50 [&_option:disabled]:text-brand/50 [&_option:hover]:bg-pop/40 [&_option::checkmark]:hidden"
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}
                                            required
                                        >
                                            <option value="" disabled>Choose a language</option>
                                            {PROGRAMMING_LANGUAGES.filter((lang) => lang !== "other").map((lang) => (
                                                <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" size={18} strokeWidth={2.5} aria-hidden="true" />
                                    </div>
                                </label>
                            )}
                        </div>

                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-2 text-2xl font-semibold">Activity Type</legend>
                            <div className="grid gap-4 md:grid-cols-2">
                                {ACTIVITY_TYPES.map((option) => {
                                    const [title, description] = TYPE_LABELS[option].split(": ")
                                    return (
                                        <label
                                            key={option}
                                            className="relative flex cursor-pointer items-start gap-4 rounded-xl border border-brand/15 bg-white p-4 pr-12 hover:border-brand/40 has-[:checked]:border-2 has-[:checked]:border-brand has-[:checked]:bg-pop/25 has-[:checked]:p-[15px] has-[:checked]:pr-[47px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pop"
                                        >
                                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-pop/60">
                                                {option === "coding" ? (
                                                    <Code size={26} strokeWidth={2.25} aria-hidden="true" />
                                                ) : (
                                                    <ListOrdered size={26} strokeWidth={2.25} aria-hidden="true" />
                                                )}
                                            </span>
                                            <span className="flex flex-col gap-1">
                                                <span className="text-xl font-bold">{title}</span>
                                                <span className="text-lg text-brand/70">
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
                    <section className="flex flex-col gap-5 md:h-[70dvh] md:min-h-[40rem]">
                        <h2 className="flex items-center gap-3 text-3xl font-bold">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-2xl text-white">2</span>
                            Questions
                            <span className="ml-3 rounded-full bg-pop/50 px-2.5 py-0.5 text-xl font-semibold">
                                {questions.length} {questions.length === 1 ? "question" : "questions"}
                            </span>
                        </h2>

                        <div className="flex flex-col gap-5 md:min-h-0 md:flex-1 md:flex-row">
                            <nav aria-label="Question Navigation" className="flex flex-col gap-2 rounded-xl border border-brand/10 bg-brand/[0.03] p-4 md:relative md:w-1/4 md:min-w-64 md:max-w-sm md:shrink-0">
                                {/* On desktop the nav stretches to the height of the question editor,
                                    so the list scrolls once it reaches the bottom of the editor. */}
                                <div className="flex flex-col gap-3 md:absolute md:inset-4">
                                    <div ref={listRef} className="flex max-h-80 min-h-0 flex-col gap-2 overflow-y-auto md:max-h-none">
                                    {questions.map((item, index) => (
                                        // One wrapper per question so the list's children still line up with
                                        // the questions (the scroll effect above relies on that).
                                        <div key={index} className="group relative shrink-0">
                                        <button
                                            type="button"
                                            className={`flex w-full cursor-pointer items-center gap-4 rounded-lg py-3 pl-4 pr-12 text-left ${
                                                index === selected
                                                    ? "bg-brand text-white"
                                                    : "text-brand hover:bg-pop/40"
                                            }`}
                                            onClick={() => setSelected(index)}
                                            aria-current={index === selected ? "step" : undefined}
                                        >
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg font-bold ${
                                                index === selected ? "bg-white text-brand" : "bg-white text-brand ring-1 ring-brand/15"
                                            }`}>
                                                {index + 1}
                                            </span>
                                            <span className="flex min-w-0 flex-col">
                                                <span className="text-xl font-bold">Question {index + 1}</span>
                                                <span className={`truncate text-base ${index === selected ? "text-white/80" : "text-brand/60"}`}>
                                                    {item.question.trim() || "Not written yet"}
                                                </span>
                                            </span>
                                        </button>
                                        {/* Shows on hover (or keyboard focus). Hidden when only one question is left. */}
                                        {questions.length > 1 && (
                                            <button
                                                type="button"
                                                className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ${
                                                    index === selected
                                                        ? "text-white/80 hover:bg-white/15 hover:text-white"
                                                        : "text-brand/60 hover:bg-brand/10 hover:text-brand"
                                                }`}
                                                onClick={() => removeQuestion(index)}
                                                aria-label={`Remove question ${index + 1}`}
                                                title="Remove question"
                                            >
                                                <X size={16} strokeWidth={2.5} aria-hidden="true" />
                                            </button>
                                        )}
                                        </div>
                                    ))}
                                    </div>

                                    <button
                                        type="button"
                                        className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-brand/40 px-4 py-3 text-xl font-semibold text-brand hover:bg-pop/40 disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={addQuestion}
                                        disabled={questions.length >= ACTIVITY_MAX_QUESTIONS}
                                        aria-label="Add another question"
                                    >
                                        <span aria-hidden="true" className="text-2xl leading-none">+</span>
                                        Question
                                    </button>
                                </div>
                            </nav>

                            {current && (
                                <section className="flex min-w-0 flex-1 flex-col gap-5 rounded-xl border border-brand/10 bg-white p-6 md:min-h-0 md:overflow-y-auto">
                                    <div className="flex items-center justify-between gap-4">
                                        <h3 className="text-3xl font-bold">Question {selected + 1}</h3>
                                        {questions.length > 1 && (
                                            <button
                                                type="button"
                                                className="cursor-pointer rounded-md px-3 py-1.5 text-lg text-red-600 hover:bg-red-50"
                                                onClick={() => removeQuestion(selected)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>

                                    <label className="flex flex-col gap-2 text-2xl font-semibold md:flex-1">
                                        Question
                                        <textarea
                                            className="h-48 resize-none md:h-auto md:min-h-48 md:flex-1 overflow-y-auto rounded-lg border border-brand/20 p-4 text-xl font-normal text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-pop"
                                            value={current.question}
                                            onChange={(e) => updateQuestion(selected, { question: e.target.value })}
                                            placeholder={type === "coding" ? "Write the programming challenge..." : "Write what the finished code should do..."}
                                            maxLength={ACTIVITY_MAX_LENGTH}
                                            required
                                        />
                                    </label>

                                    {type === "coding" ? (
                                        // Styles CodingQuestion's output box as a terminal from here.
                                        // The label text is 32px tall with an 8px gap, so the box starts 40px down.
                                        <div className="relative flex flex-col md:flex-1 [&_label]:flex-1 [&_label]:gap-2 [&_label]:text-2xl [&_label]:font-semibold [&_label]:text-brand [&_textarea]:min-h-64 [&_textarea]:flex-1 [&_textarea]:resize-none [&_textarea]:rounded-lg [&_textarea]:border-0 [&_textarea]:bg-[#16113f] [&_textarea]:px-4 [&_textarea]:pb-4 [&_textarea]:pt-16 [&_textarea]:font-mono [&_textarea]:text-lg [&_textarea]:text-white [&_textarea::placeholder]:text-white/40 [&_textarea:focus]:ring-2 [&_textarea:focus]:ring-pop">
                                            <div className="pointer-events-none absolute inset-x-0 top-10 flex items-center gap-2 rounded-t-lg border-b border-white/10 bg-[#221a55] px-4 py-2.5 font-mono text-base text-white/90">
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

                    {/* Section 3: the teacher's private notes */}
                    <section className="flex flex-col gap-3">
                        <h2 className="flex items-center gap-3 text-3xl font-bold">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-2xl text-white">3</span>
                            Your Notes
                        </h2>
                        <label className="flex flex-col gap-2 text-2xl font-semibold">
                            Notes for yourself (optional)
                            <span className="text-lg font-normal text-brand/70">
                                Only you can see these. They're kept with the activity and shown every time you use it.
                            </span>
                            <textarea
                                className="min-h-32 resize-y rounded-lg border border-brand/20 bg-white px-4 py-3 text-xl font-normal text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-pop"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Things to remember when you run this activity..."
                                maxLength={NOTE_MAX_LENGTH}
                                rows={4}
                            />
                        </label>
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
                            {saving ? "Saving..." : "Finish"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}
