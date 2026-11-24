import { useEffect, useState } from "react"
import type { ActivityDetail, ActivityDetailQuestion, ActivitySummary } from "../types"
import { getActivity } from "../api"
import { activityLanguageLabel } from "../utils/activityLabels"
import { PopoverTitle } from "@/components/ui/popover"

// How each activity type is shown in the preview.
const TYPE_LABELS: Record<ActivitySummary["type"], string> = {
    coding: "Coding",
    parsons: "Parsons problem",
}

// The width and padding every caller gives PopoverContent, so the preview looks the same on each page.
// Padding is 0 because the preview pads its own header and list, letting the list scroll edge to edge.
export const ACTIVITY_PREVIEW_CLASS = "w-[34rem] max-w-[calc(100vw-2rem)] p-0"

// How close the preview may get to each edge of the window. The top leaves room for the
// dashboard header (h-20 = 80px) plus a gap, so a tall preview never slides up over it.
export const ACTIVITY_PREVIEW_COLLISION_PADDING = { top: 88, right: 8, bottom: 8, left: 8 }

type DetailState =
    | { status: "loading" }
    | { status: "ready"; detail: ActivityDetail }
    | { status: "error"; message: string }

// A small rounded label in the header, e.g. "Coding" or "Python".
function Chip({ children }: { children: React.ReactNode }) {
    return <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-medium text-brand">{children}</span>
}

// The label above an answer block, e.g. "Expected output".
function AnswerLabel({ children }: { children: React.ReactNode }) {
    return <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</p>
}

// A grey bar that pulses while the answer loads, about the height of a short output.
function AnswerSkeleton() {
    return <div className="mt-3 h-12 animate-pulse rounded-md bg-neutral-100" aria-hidden="true" />
}

// The answer under one question: the expected output for coding, or every line students are handed for Parsons.
function Answer({ type, item }: { type: ActivitySummary["type"]; item: ActivityDetailQuestion }) {
    if (type === "coding") {
        return (
            <div className="mt-3">
                <AnswerLabel>Expected output</AnswerLabel>
                {item.output ? (
                    // Kept exactly as saved (spaces and line breaks matter for grading), scrolling inside if it's long.
                    <pre className="max-h-40 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs leading-relaxed text-gray-900">{item.output}</pre>
                ) : (
                    <p className="text-sm italic text-gray-500">No output saved.</p>
                )}
            </div>
        )
    }

    // Rows as the teacher typed them. Blank rows aren't saved, so dropping them here changes nothing.
    const codeLines = (item.code ?? "").split("\n").filter((line) => line.trim() !== "")
    const extraLines = (item.distractors ?? "").split("\n").filter((line) => line.trim() !== "")
    // Every line a student could be handed, mixed together the way they start out and all looking alike:
    // no indentation and no mark on the extra lines, so the preview gives away neither the order nor the distractors.
    const pool = jumble([...codeLines, ...extraLines].map((line) => line.trim()))
    return (
        <div className="mt-3">
            <AnswerLabel>Lines · {pool.length} {pool.length === 1 ? "line" : "lines"}</AnswerLabel>
            <ul className="flex max-h-48 flex-col gap-1 overflow-auto">
                {pool.map((line, i) => (
                    <li key={i} className="rounded-md border border-neutral-200 bg-white px-3 py-1 font-mono text-xs text-gray-900">
                        <span className="whitespace-pre">{line}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

// Mixes lines into an order that looks shuffled but is the same every time, so the preview
// doesn't reshuffle each time it opens. Each line is ordered by a hash of its text and position.
function jumble(lines: string[]): string[] {
    const hash = (value: string) => {
        let h = 2166136261
        for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
        return h >>> 0
    }
    return lines
        .map((line, i) => ({ line, key: hash(`${i}:${line}`) }))
        .sort((a, b) => a.key - b.key)
        .map(({ line }) => line)
}

// What the hover preview shows for one activity: a header with its type, language, size and date,
// then every question as a card with its answer underneath. Put it inside a PopoverContent with ACTIVITY_PREVIEW_CLASS.
//
// The question text comes with the activity list, so it shows right away. The answers load from the
// server when the preview first opens (it only mounts while open), and are cached after that.
export default function ActivityPreview({ activity }: { activity: ActivitySummary }) {
    const [state, setState] = useState<DetailState>({ status: "loading" })

    useEffect(() => {
        let cancelled = false
        setState({ status: "loading" })
        getActivity(activity.id)
            .then((detail) => { if (!cancelled) setState({ status: "ready", detail }) })
            .catch((err) => { if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Could not load the answers." }) })
        return () => { cancelled = true }
    }, [activity.id])

    const language = activityLanguageLabel(activity)
    // Once loaded, the detail is the source of truth. Until then, the list's question text fills the cards.
    // The list's questions may be missing if it came from an older server; rendering must never throw here,
    // since the preview only mounts on hover and an error would blank the whole page.
    const detailQuestions = state.status === "ready" ? state.detail.questions : null
    const listQuestions = Array.isArray(activity.questions) ? activity.questions : null
    const questionTexts = detailQuestions?.map((q) => q.question) ?? listQuestions
    const count = questionTexts?.length ?? activity.questionCount ?? 0
    const created = new Date(activity.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

    return (
        // At most 36rem, and never taller than the room the popover has on screen (--available-height,
        // set by its positioner), so it shrinks and scrolls instead of being pushed over the header.
        <div className="flex max-h-[min(36rem,var(--available-height))] flex-col">
            <div className="border-b border-brand/15 px-5 pt-4 pb-3">
                <PopoverTitle className="text-lg break-words">{activity.name}</PopoverTitle>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {TYPE_LABELS[activity.type] && <Chip>{TYPE_LABELS[activity.type]}</Chip>}
                    {language && <Chip>{language}</Chip>}
                    <span className="text-xs text-gray-600">{count} {count === 1 ? "question" : "questions"} · Created {created}</span>
                </div>
            </div>

            {state.status === "error" && (
                <p role="alert" className="mx-5 mt-3 rounded-md bg-warn px-3 py-2 text-sm text-brand">{state.message}</p>
            )}

            {questionTexts === null ? (
                <p className="px-5 py-4 text-sm text-gray-600">Loading questions...</p>
            ) : count === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-600">No questions yet.</p>
            ) : (
                // The only part that scrolls, so the header stays in view on long activities.
                <ol className="flex flex-col gap-3 overflow-y-auto px-5 py-4" aria-label="Questions">
                    {questionTexts.map((text, i) => (
                        <li key={i} className="rounded-lg border border-brand/15 bg-white p-3 shadow-xs">
                            <div className="flex items-start gap-2.5">
                                <span className="mt-0.5 shrink-0 rounded-md bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">Q{i + 1}</span>
                                <p className="text-sm whitespace-pre-wrap break-words text-gray-900">{text}</p>
                            </div>
                            {state.status === "loading" && <AnswerSkeleton />}
                            {detailQuestions?.[i] && <Answer type={activity.type} item={detailQuestions[i]} />}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    )
}
