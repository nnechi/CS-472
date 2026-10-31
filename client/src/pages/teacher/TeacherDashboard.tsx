import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import useAuth from "../../hooks/useAuth"
import { listActivities } from "../../api"
import type { ActivitySummary } from "../../types"

// /dashboard -- the teacher's home page. Activities and notes are in the ☰ menu.
export default function TeacherDashboard() {
    const { auth } = useAuth()
    const navigate = useNavigate()

    // The activities for the "Start a room" dropdown. Null until they load.
    const [activities, setActivities] = useState<ActivitySummary[] | null>(null)
    const [listError, setListError] = useState("")
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        if (!auth) return
        let cancelled = false
        listActivities(auth.user.id)
            .then((found) => { if (!cancelled) setActivities(found) })
            .catch((err) => {
                if (!cancelled) setListError(err instanceof Error ? err.message : "Could not load your activities.")
            })
        return () => { cancelled = true }
    }, [auth?.user.id])

    // Opens the room creation page with this activity already chosen, the same way Activity's "Start Room" does.
    function startRoom(activityId: string) {
        setMenuOpen(false)
        navigate("/dashboard/room-creation", { state: { activityId } })
    }

    function displayChoices() {
        if (listError) return <p role="alert" className="rounded-md bg-warn px-3 py-2 text-brand">{listError}</p>
        if (activities === null) return <p className="px-3 py-2 text-gray-600">Loading your activities...</p>
        if (activities.length === 0) {
            return (
                <p className="px-3 py-2 text-gray-600">
                    You haven't made any activities yet. <Link to="/dashboard/create-activity" className="underline">Create an activity</Link>
                </p>
            )
        }
        return activities.map((a) => (
            <button
                key={a.id}
                type="button"
                className="block w-full rounded-md px-3 py-2 text-left text-brand cursor-pointer hover:bg-pop"
                onClick={() => startRoom(a.id)}
            >
                {a.name}
            </button>
        ))
    }

    return (
        <section className="mt-8 flex flex-col gap-8">
            <h1 className="text-5xl font-bold">Welcome{auth ? `, ${auth.user.name}!` : ""}</h1>
            <div className="relative w-fit">
                <button
                    type="button"
                    className="rounded-lg bg-brand px-4 py-2 text-lg text-white cursor-pointer hover:bg-brand/90"
                    aria-haspopup="listbox"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    Start a room ▾
                </button>
                {menuOpen && (
                    <div className="absolute left-0 top-full z-20 mt-2 flex max-h-80 w-72 flex-col overflow-y-auto rounded-lg border border-brand bg-white p-2 shadow-md">
                        {displayChoices()}
                    </div>
                )}
            </div>
        </section>
    )
}
