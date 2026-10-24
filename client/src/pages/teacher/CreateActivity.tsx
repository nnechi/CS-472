import { FormEvent, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { createActivity } from "../../api"
import useAuth from "../../hooks/useAuth"
import { ACTIVITY_MAX_LENGTH, ACTIVITY_NAME_MAX_LENGTH, ActivityQuestion, PROGRAMMING_LANGUAGES, ProgrammingLanguage } from "../../types"

const EMPTY_QUESTION : ActivityQuestion = { question: "", output: "" }

// /dashboard/create-activity -- a teacher writes an activity and saves it under
// their account. Only that teacher can use it in their rooms.
export default function CreateActivity(){
    const navigate = useNavigate()
    const { auth } = useAuth()
    const [name, setName] = useState("")
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

    function addQuestion(){
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
        if (!auth || saving || !language) return
        setSaving(true)
        setError("")
        try {
            await createActivity(auth.user.id, name, language, questions)
            navigate("/dashboard")
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

            <div className="flex flex-col gap-6 md:flex-row">
                <nav  aria-label="Question Navigation" className="flex flex-col gap-2 rounded-lg border border-gray-300 p-3 md:w-56 md:shrink-0">
                    <div ref={listRef} className="flex max-h-80 flex-col gap-2 overflow-y-auto">
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
                        className="rounded-lg border border-gray-300 px-3 py-2 text-left text-base text-gray-900 cursor-pointer hover:bg-neutral-100"
                        onClick={addQuestion}
                        aria-label="Add another question"
                    >
                        + Question
                    </button>
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
                                placeholder="Write the programming challenge..."
                                maxLength={ACTIVITY_MAX_LENGTH}
                                required
                            />
                        </label>

                        <label className="flex flex-col gap-1 text-sm text-gray-600">
                            Correct output
                            <textarea
                                className="min-h-32 rounded-lg border border-gray-300 p-3 text-base text-black focus:border-indigo-600 focus:outline-none"
                                value={current.output}
                                onChange={(e) => updateQuestion(selected, { output: e.target.value })}
                                placeholder="Enter the correct output for the question..."
                                maxLength={ACTIVITY_MAX_LENGTH}
                                required
                            />
                        </label>

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
