import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import useAuth from "../../hooks/useAuth"
import Activity from "../../components/Activity"
import { listActivities } from "../../api"
import type { ActivitySummary } from "../../types"

// Teachers create a Socket.IO room and share its code with students.
export default function TeacherDashboard() {
    const { auth } = useAuth()
    const navigate = useNavigate()
    // The teacher's own activities, A to Z. null until they have loaded.
    const [activities, setActivities] = useState<ActivitySummary[] | null>(null)
    const [listError, setListError] = useState("")

    useEffect(() => {
        if (!auth) return
        let cancelled = false
        listActivities(auth.user.id)
            .then((found) => { if (!cancelled) setActivities(found) })
            .catch((e) => {
                console.error(e)
                if (!cancelled) setListError(e instanceof Error ? e.message : "Could not load your activities.")
            })
        return () => { cancelled = true }
    }, [auth])

    return (
        <>
            {/* Section for showing the activites created by the current user */}
            <section>
                <h1 className="mt-8 text-6xl font-bold">Welcome{auth ? `, ${auth.user.name}!` : ""}</h1>
                <div className="mt-10 flex items-center justify-between">
                    <h2 className="text-4xl font-bold">Your Activities</h2>
                    <button
                        type="button"
                        className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                        onClick={() => navigate("/dashboard/create-activity")}
                    >
                        Create New Activity
                    </button>
                </div>

                <div className="mt-4 rounded-lg bg-gray-100 p-4 h-150 overflow-y-auto space-y-4">
                    {listError ? (
                        <p className="text-red-600">{listError}</p>
                    ) : activities === null ? (
                        <p className="text-gray-600">Loading your activities...</p>
                    ) : activities.length === 0 ? (
                        <p className="text-gray-600">You haven't made any activities yet.</p>
                    ) : (
                        activities.map((a) => <Activity key={a.id} name={a.name} />)
                    )}
                </div>
            </section>
        </>
    )
}
