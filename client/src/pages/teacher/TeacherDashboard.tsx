import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import useAuth from "../../hooks/useAuth"
import { listActivities, listRoomStats } from "../../api"
import type { ActivitySummary, RoomStatSummary } from "../../types"
import { AverageSessionTile, RecentRoomsTable, RoomsPerWeekChart, StatCard } from "../../components/dashboard/RoomStats"

// /dashboard -- the teacher's home page. Activities and notes are in the ☰ menu.
export default function TeacherDashboard() {
    const { auth } = useAuth()
    const navigate = useNavigate()
    // The first word of the teacher's name, for the greeting ("Savannah Michalsky" -> "Savannah").
    const firstName = auth?.user.name?.trim().split(/\s+/)[0] ?? ""

    // The activities for the "Start a room" dropdown. Null until they load.
    const [activities, setActivities] = useState<ActivitySummary[] | null>(null)
    const [listError, setListError] = useState("")
    const [menuOpen, setMenuOpen] = useState(false)

    // The rooms this teacher ended, for the stats below. Null until they load.
    const [pastRooms, setPastRooms] = useState<RoomStatSummary[] | null>(null)
    const [statsError, setStatsError] = useState("")

    useEffect(() => {
        if (!auth) return
        let cancelled = false
        listRoomStats()
            .then((rooms) => {
                if (!cancelled) setPastRooms(rooms)
            })
            .catch((err) => {
                if (!cancelled) setStatsError(err instanceof Error ? err.message : "Could not load your room stats.")
            })
        return () => { cancelled = true }
    }, [auth?.user.id])

    useEffect(() => {
        if (!auth) return
        let cancelled = false
        listActivities(auth.user.id)
            .then((found) => {
                // Newest first. The server sends them A to Z, so sort them here.
                const newestFirst = [...found].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
                if (!cancelled) setActivities(newestFirst)
            })
            .catch((err) => {
                if (!cancelled) setListError(err instanceof Error ? err.message : "Could not load your activities.")
            })
        return () => { cancelled = true }
    }, [auth?.user.id])

    // Opens the room creation page with this activity already chosen, the same way Activity's "Start Room" does.
    function startRoom(activityId: string) {
        setMenuOpen(false)
        navigate("/room-creation", { state: { activityId } })
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
                className="block w-full rounded-md px-3 py-2 text-left text-brand cursor-pointer hover:bg-[#ccc9f7]"
                onClick={() => startRoom(a.id)}
            >
                {a.name}
            </button>
        ))
    }

    return (
        <section className="mt-8 flex flex-col gap-8">
            <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                    <h1 className="text-4xl font-bold">Welcome back{firstName ? `, ${firstName}` : ""}!</h1>
                    <p className="mt-2 text-lg text-[#5a52a6]">Here's your current overview and work history.</p>
                </div>
                {/* The menu opens to the left so it stays on screen at the right edge. */}
                <div className="relative shrink-0">
                    <button
                        type="button"
                        className="rounded-lg bg-brand px-4 py-2 text-lg text-white cursor-pointer hover:bg-brand/90"
                        aria-haspopup="listbox"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        Start a room {menuOpen ? "▴" : "▾"}
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-full z-20 mt-2 flex max-h-80 w-72 flex-col overflow-y-auto rounded-lg border-2 border-brand bg-white p-2 shadow-md">
                            {displayChoices()}
                        </div>
                    )}
                </div>
            </div>
            {/* Spans the full width of the header, under the subtitle and the Start a room button. */}
            <div className="h-1 w-full rounded-full bg-brand" aria-hidden="true" />
            </div>

            {statsError && <p role="alert" className="rounded-md bg-warn px-3 py-2 text-brand">{statsError}</p>}
            {!statsError && pastRooms === null && <p className="text-gray-600">Loading your room stats...</p>}
            {pastRooms !== null && (
                <>
                    <div className="grid gap-6 md:grid-cols-3">
                        <AverageSessionTile rooms={pastRooms} />
                        <StatCard title="Rooms run per week (last 12 weeks)" className="md:col-span-2" selected>
                            <RoomsPerWeekChart rooms={pastRooms} />
                        </StatCard>
                    </div>
                    <div className="h-1 w-full rounded-full bg-brand" aria-hidden="true" />
                    <section className="flex flex-col gap-3">
                        <h2 className="text-2xl font-semibold text-brand">Recent rooms</h2>
                        {/* Same look as the selected Coding / Parsons type cards in Create Activity. */}
                        <div className="rounded-xl border-2 border-brand bg-pop/25 p-5">
                            <RecentRoomsTable rooms={pastRooms} />
                        </div>
                    </section>
                </>
            )}
        </section>
    )
}
