import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { getRoomNotes, saveActivityNote, saveRoomNote } from "../api"
import { NOTE_MAX_LENGTH, type RoomNotes } from "../types"

// Teacher notes. Only the teacher who writes a note can ever see it: notes load
// and save over the teacher's own login, never over the room's socket, which
// students share.

// How long after the teacher stops typing a note is saved.
const SAVE_DELAY_MS = 800

// ---------- NotesField: the box itself ----------

interface NotesFieldProps {
    // The heading above the box, e.g. "Notes for this room".
    title: string
    // A line under the heading, e.g. when the note is saved.
    description?: string
    value: string
    onChange: (text: string) => void
    onBlur?: () => void
    placeholder?: string
    // While false, the box can't be typed in (e.g. the note is still loading).
    editable?: boolean
    // A short status, such as "Saving..." or "Saved", shown next to the heading.
    status?: string
    // Something to show at the end of the heading row, such as a link.
    action?: ReactNode
    // A problem to show under the box, such as a failed save.
    problem?: ReactNode
}

// A labelled notes box. Saving is up to the caller: TeacherNotes below saves as
// you type; the Create Activity and Create a Room pages save it with the activity
// or room, because before then there's nothing to attach it to.
export function NotesField({
    title,
    description,
    value,
    onChange,
    onBlur,
    placeholder = "Only you can see these notes.",
    editable = true,
    status,
    action,
    problem,
}: NotesFieldProps) {
    const id = useId()
    const nearLimit = value.length > NOTE_MAX_LENGTH * 0.9

    return (
        <div className="flex flex-col gap-2 text-brand">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <label htmlFor={id} className="text-lg font-semibold">
                    {title}
                </label>
                <span className="flex items-baseline gap-3">
                    {status && (
                        <span role="status" aria-live="polite" className="text-sm text-brand/70">
                            {status}
                        </span>
                    )}
                    {action}
                </span>
            </div>
            {description && (
                <p id={`${id}-description`} className="-mt-1 text-sm text-brand/70">
                    {description}
                </p>
            )}
            <textarea
                id={id}
                aria-describedby={description ? `${id}-description` : undefined}
                className="min-h-28 w-full resize-y rounded-lg border border-brand/20 bg-white px-3 py-2 text-base text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-pop disabled:cursor-not-allowed disabled:opacity-60"
                rows={5}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                maxLength={NOTE_MAX_LENGTH}
                disabled={!editable}
            />
            {nearLimit && (
                <p className="text-right text-sm text-brand/70">
                    {value.length} / {NOTE_MAX_LENGTH} characters
                </p>
            )}
            {problem && (
                <p role="alert" className="text-sm text-red-700">
                    {problem}
                </p>
            )}
        </div>
    )
}

// ---------- TeacherNotes: a note that saves as you type ----------

type NoteState = "loading" | "load-failed" | "ready" | "unsaved" | "saving" | "saved" | "save-failed"

interface TeacherNotesProps {
    title: string
    description?: string
    placeholder?: string
    action?: ReactNode
    // Which note this is, e.g. "room:ABC123". When it changes, the box shows that note instead.
    noteKey: string
    // Loads the note's text.
    load: () => Promise<string>
    // Saves the note's text. Empty text deletes the note.
    save: (text: string) => Promise<unknown>
}

// A note that loads itself and saves itself: a moment after the teacher stops
// typing, when they click away, and before the box closes or switches notes.
// If a save fails, the text stays in the box and is sent again with the next
// change or with Try again.
export default function TeacherNotes({ title, description, placeholder, action, noteKey, load, save }: TeacherNotesProps) {
    const [text, setText] = useState("")
    const [state, setState] = useState<NoteState>("loading")
    const [problem, setProblem] = useState("")
    const [reloads, setReloads] = useState(0)

    // The latest load and save, so the effects below don't rerun every time the page re-renders.
    const loadRef = useRef(load)
    loadRef.current = load
    const saveRef = useRef(save)
    saveRef.current = save

    // Counts which note is on screen. Results for a note no longer shown are ignored.
    const shown = useRef(0)
    // A change not sent yet: its text, and the save function of the note it belongs to.
    const pending = useRef<{ text: string; save: (text: string) => Promise<unknown>; shown: number } | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Saves run one after another, so an older save can never land after a newer one.
    const queue = useRef<Promise<void>>(Promise.resolve())

    // Sends the unsaved change now, if there is one.
    const flush = useCallback(() => {
        if (timer.current) {
            clearTimeout(timer.current)
            timer.current = null
        }
        const change = pending.current
        if (!change) return
        pending.current = null
        const stillShown = () => change.shown === shown.current
        if (stillShown()) setState("saving")
        queue.current = queue.current
            .then(() => change.save(change.text))
            .then(
                () => {
                    if (stillShown() && !pending.current) setState("saved")
                },
                (error: unknown) => {
                    console.error(error)
                    if (!stillShown()) return
                    // Keep the change, so the next edit or Try again sends it.
                    if (!pending.current) pending.current = change
                    setProblem(error instanceof Error ? error.message : "Could not save your note.")
                    setState("save-failed")
                },
            )
    }, [])

    // Load the note whenever it changes (or after Try again).
    useEffect(() => {
        const current = ++shown.current
        setText("")
        setProblem("")
        setState("loading")
        loadRef.current().then(
            (loaded) => {
                if (current !== shown.current) return
                setText(loaded)
                setState("ready")
            },
            (error: unknown) => {
                console.error(error)
                if (current !== shown.current) return
                setProblem(error instanceof Error ? error.message : "Could not load your note.")
                setState("load-failed")
            },
        )
        // Leaving this note (the box closes or shows another note): save what's left.
        return () => flush()
    }, [noteKey, reloads, flush])

    // Closing or reloading the tab with an unsaved change: ask the browser to warn first.
    useEffect(() => {
        function warnIfUnsaved(event: BeforeUnloadEvent) {
            if (!pending.current && state !== "saving") return
            flush()
            event.preventDefault()
        }
        window.addEventListener("beforeunload", warnIfUnsaved)
        return () => window.removeEventListener("beforeunload", warnIfUnsaved)
    }, [state, flush])

    function change(next: string) {
        setText(next)
        setProblem("")
        setState("unsaved")
        pending.current = { text: next, save: saveRef.current, shown: shown.current }
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(flush, SAVE_DELAY_MS)
    }

    function tryAgain() {
        if (state === "load-failed") setReloads((n) => n + 1)
        else flush()
    }

    const status = {
        loading: "Loading...",
        "load-failed": "",
        ready: "",
        unsaved: "Not saved yet",
        saving: "Saving...",
        saved: "Saved",
        "save-failed": "Not saved",
    }[state]

    return (
        <NotesField
            title={title}
            description={description}
            placeholder={placeholder}
            action={action}
            value={text}
            onChange={change}
            onBlur={flush}
            // Never editable before it loads: saving then would replace the real note.
            editable={state !== "loading" && state !== "load-failed"}
            status={status}
            problem={
                problem && (
                    <>
                        {problem}{" "}
                        <button type="button" className="cursor-pointer font-semibold underline" onClick={tryAgain}>
                            Try again
                        </button>
                    </>
                )
            }
        />
    )
}

// ---------- RoomNotesPanel: the notes inside a room ----------

// The notes shown inside a room, live or saved: the room's own note, and the
// note on the activity it uses (if it has one).
export function RoomNotesPanel({ roomCode }: { roomCode: string }) {
    const [notes, setNotes] = useState<RoomNotes | null>(null)
    const [problem, setProblem] = useState("")
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let cancelled = false
        setNotes(null)
        setProblem("")
        getRoomNotes(roomCode).then(
            (loaded) => {
                if (!cancelled) setNotes(loaded)
            },
            (error: unknown) => {
                console.error(error)
                if (!cancelled) setProblem(error instanceof Error ? error.message : "Could not load your notes.")
            },
        )
        return () => {
            cancelled = true
        }
    }, [roomCode, attempt])

    const activity = notes?.activity ?? null

    return (
        <section aria-label="Your notes" className="rounded-lg border border-brand/30 bg-white p-4 text-brand">
            <p className="mb-3 text-sm text-brand/70">Only you can see these notes. Students never do.</p>
            {problem ? (
                <p role="alert" className="text-sm text-red-700">
                    {problem}{" "}
                    <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setAttempt((n) => n + 1)}>
                        Try again
                    </button>
                </p>
            ) : notes === null ? (
                <p className="text-sm text-brand/70">Loading your notes...</p>
            ) : (
                <div className={activity ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
                    <TeacherNotes
                        title="Notes for this room"
                        description="Just for this room: how it went, who needs a follow-up."
                        noteKey={`room:${roomCode}`}
                        load={() => Promise.resolve(notes.room.text)}
                        save={(text) => saveRoomNote(roomCode, text)}
                    />
                    {activity && (
                        <TeacherNotes
                            title={`Notes on "${activity.activityName}"`}
                            description="Kept with the activity, and shown every time you use it."
                            noteKey={`activity:${activity.activityId}`}
                            load={() => Promise.resolve(activity.text)}
                            save={(text) => saveActivityNote(activity.activityId, text)}
                        />
                    )}
                </div>
            )}
        </section>
    )
}
