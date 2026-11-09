import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { HistoryIcon } from "../../components/MenuIcons"
import { listPastRooms, SessionEndedError } from "../../api"
import useAuth from "../../hooks/useAuth"
import type { PastRoomSummary } from "../../types"

// /dashboard/previous-activities -- rooms this teacher ran that have ended, newest first.
// Clicking one opens the read-only teacher room view at /previous-rooms/<code>.
export default function PreviousActivities() {
    // null while loading, so an empty list and an unloaded list look different
    const [rooms, setRooms] = useState<PastRoomSummary[] | null>(null)
    const [listError, setListError] = useState("")
    const { setAuth } = useAuth()

    useEffect(() => {
        let cancelled = false
        listPastRooms()
            .then((found) => { if (!cancelled) setRooms(found) })
            .catch((e) => {
                if (cancelled) return
                // The server no longer knows this user (e.g. it restarted). Sign out
                // here too, so RequireAuth sends them to /login and back afterwards.
                if (e instanceof SessionEndedError) {
                    setAuth(null)
                    return
                }
                console.error(e)
                setListError(e instanceof Error ? e.message : "Could not load your previous activities.")
            })
        return () => { cancelled = true }
    }, [setAuth])

    function displayRooms() {
        if (listError)
            return <p className="text-red-600">{listError}</p>

        if (rooms === null)
            return <p className="text-gray-600">Loading your previous activities...</p>

        if (rooms.length === 0)
            return <p className="text-gray-600">No previous activities yet. Rooms you end will show up here.</p>

        return (
            <ul className="space-y-4">
                {rooms.map((r) => (
                    <li key={r.code}>
                        <Link
                            to={`/previous-rooms/${encodeURIComponent(r.code)}`}
                            className="group flex items-center gap-3 rounded-lg p-4 hover:bg-brand-light"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white group-hover:bg-brand-light">
                                <HistoryIcon className="h-6 w-6 text-brand" />
                            </span>
                            <div>
                                <p className="text-lg">{r.activityName || "Activity"}</p>
                                <p className="text-sm text-gray-600">
                                    Room {r.code} · Ended {new Date(r.endedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {r.studentCount} {r.studentCount === 1 ? "student" : "students"}
                                </p>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        )
    }

    return (
        <section className="flex h-full flex-col">
            <h1 className="mt-8 text-4xl font-bold">Previous activities</h1>
            <div className="mt-4 min-h-60 flex-1 overflow-y-auto rounded-lg p-4">
                {displayRooms()}
            </div>
        </section>
    )
}
