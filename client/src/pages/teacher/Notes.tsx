import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import useSessionEnded from "../../hooks/useSessionEnded"
import TeacherNotes from "../../components/TeacherNotes"
import { listNotes, saveActivityNote, saveRoomNote } from "../../api"
import type { NoteSummary } from "../../types"

// A date and time, the same way Previous Activities shows them.
function when(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

// What a note is about, a line describing it, and where to open it.
function describe(note: NoteSummary): { title: string; detail: string; link: string; linkLabel: string } {
    if (note.kind === "activity") {
        return {
            title: note.activityName ?? "Activity",
            detail: `Activity notes · Last changed ${when(note.updatedAt)}`,
            link: `/dashboard/activities?activity=${encodeURIComponent(note.targetId)}`,
            linkLabel: "View activity",
        }
    }
    const activity = note.activityName ?? "No activity"
    if (note.roomStatus === "previous") {
        return {
            title: `Room ${note.targetId}`,
            detail: `${activity} · Ended ${note.endedAt ? when(note.endedAt) : ""}`,
            link: `/previous-rooms/${encodeURIComponent(note.targetId)}`,
            linkLabel: "View room",
        }
    }
    return {
        title: `Room ${note.targetId}`,
        detail: `${activity} · In progress`,
        link: `/rooms/${encodeURIComponent(note.targetId)}`,
        linkLabel: "Go to room",
    }
}

// /dashboard/notes -- every note the teacher has written, most recently changed
// first. Each one can be edited right here, and saves as they type.
export default function Notes() {
    const sessionEnded = useSessionEnded()
    // Null while loading.
    const [notes, setNotes] = useState<NoteSummary[] | null>(null)
    const [error, setError] = useState("")

    useEffect(() => {
        let cancelled = false
        listNotes()
            .then((found) => { if (!cancelled) setNotes(found) })
            .catch((e: unknown) => {
                if (cancelled) return
                // The server no longer knows this user: RequireAuth sends them to /login, then back here.
                if (sessionEnded(e)) return
                console.error(e)
                setError(e instanceof Error ? e.message : "Could not load your notes.")
            })
        return () => { cancelled = true }
    }, [sessionEnded])

    function content() {
        if (error) return <p role="alert" className="text-red-600">{error}</p>
        if (notes === null) return <p className="text-gray-600">Loading your notes...</p>
        if (notes.length === 0) {
            return (
                <p className="text-gray-600">
                    You haven't written any notes yet. Add notes to an activity from its "..." menu on the{" "}
                    <Link to="/dashboard/activities" className="underline">Activities</Link> page, or with the
                    notebook button inside a room.
                </p>
            )
        }
        return (
            <ul className="flex flex-col gap-4">
                {notes.map((note) => {
                    const { title, detail, link, linkLabel } = describe(note)
                    return (
                        <li key={`${note.kind}:${note.targetId}`} className="rounded-lg border border-brand/20 p-4">
                            <TeacherNotes
                                title={title}
                                description={detail}
                                action={<Link to={link} className="text-sm font-semibold text-brand underline">{linkLabel}</Link>}
                                noteKey={`${note.kind}:${note.targetId}`}
                                load={() => Promise.resolve(note.text)}
                                save={(text) => note.kind === "activity" ? saveActivityNote(note.targetId, text) : saveRoomNote(note.targetId, text)}
                            />
                        </li>
                    )
                })}
            </ul>
        )
    }

    return (
        <section className="mt-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold">Notes</h1>
                <p className="text-gray-600">Your notes on activities and rooms. Only you can see them.</p>
            </div>
            {content()}
        </section>
    )
}
