import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { DoorOpen, Radio, Users, UserRoundX, X } from "lucide-react"
import { deleteRoom, listActiveRooms, SessionEndedError } from "../api"
import useAuth from "../hooks/useAuth"
import type { ActiveRoomSummary, ActivityType } from "../types"

// How often the list refreshes while the dashboard is open.
const REFRESH_MS = 30 * 1000

const TYPE_LABELS: Record<ActivityType, string> = { coding: "Coding", parsons: "Parsons problem" }

// "12 min ago", "1 h 5 min ago", "just now".
function since(iso: string | null, now: number): string {
    const at = iso ? Date.parse(iso) : NaN
    if (Number.isNaN(at)) return ""
    const minutes = Math.max(0, Math.round((now - at) / 60000))
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes} min ago`
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
}

// "in 4 min", for an expired room that ends soon.
function until(iso: string, now: number): string {
    const minutes = Math.max(1, Math.ceil((Date.parse(iso) - now) / 60000))
    return `in ${minutes} min`
}

// The dashboard's list of the teacher's rooms that are still running: rooms
// they opened and didn't end, e.g. after closing the tab or losing their
// connection. Each one can be rejoined (its students and their work are all
// still there) or ended. Shows nothing when no room is running.
export default function ActiveRooms() {
    const { auth, setAuth } = useAuth()
    const [rooms, setRooms] = useState<ActiveRoomSummary[]>([])
    const [error, setError] = useState("")
    const [ending, setEnding] = useState<string | null>(null)
    const [now, setNow] = useState(() => Date.now())

    const load = useCallback(async () => {
        try {
            const found = await listActiveRooms()
            setRooms(found)
            setError("")
            setNow(Date.now())
        } catch (e) {
            // The server no longer knows this user (e.g. it restarted): sign in again.
            if (e instanceof SessionEndedError) {
                setAuth(null)
                return
            }
            setError(e instanceof Error ? e.message : "Could not load your running rooms.")
        }
    }, [setAuth])

    // Loaded when the dashboard opens, then kept fresh while it's open and
    // whenever the teacher comes back to this tab.
    useEffect(() => {
        void load()
        const id = setInterval(() => void load(), REFRESH_MS)
        const onFocus = () => void load()
        window.addEventListener("focus", onFocus)
        return () => {
            clearInterval(id)
            window.removeEventListener("focus", onFocus)
        }
    }, [load])

    async function endRoom(room: ActiveRoomSummary) {
        if (!auth) return
        const name = room.activityName || "this room"
        if (!window.confirm(`End ${name} (${room.code}) for everyone? Students still in it will be sent out.`)) return
        setEnding(room.code)
        try {
            const ended = await deleteRoom(room.code, auth.user.id)
            if (!ended) throw new Error("This room could not be ended. Try again.")
            setRooms((current) => current.filter((r) => r.code !== room.code))
        } catch (e) {
            if (e instanceof SessionEndedError) {
                setAuth(null)
                return
            }
            setError(e instanceof Error ? e.message : "This room could not be ended. Try again.")
        } finally {
            setEnding(null)
        }
    }

    if (rooms.length === 0 && !error) return null

    return (
        <section aria-labelledby="active-rooms-heading" className="flex flex-col gap-3">
            <h2 id="active-rooms-heading" className="flex items-center gap-2 text-2xl font-bold">
                <Radio className="size-6 text-accent" aria-hidden="true" />
                Rooms in progress
            </h2>
            {error && <p role="alert" className="rounded-md bg-warn px-3 py-2 text-brand">{error}</p>}
            <ul className="flex flex-col gap-3">
                {rooms.map((room) => {
                    const startedAgo = since(room.startedAt, now)
                    return (
                        <li
                            key={room.code}
                            className="flex flex-col gap-3 rounded-xl border border-brand/20 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex min-w-0 flex-col gap-1">
                                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="truncate text-lg font-semibold">{room.activityName || "Activity"}</span>
                                    {room.activityType && (
                                        <span className="text-sm text-brand/70">{TYPE_LABELS[room.activityType]}</span>
                                    )}
                                    <span className="rounded-md bg-pop/50 px-2 py-0.5 font-mono text-sm font-bold tracking-widest">{room.code}</span>
                                </p>
                                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand/80">
                                    <span className="flex items-center gap-1">
                                        <Users className="size-4" aria-hidden="true" />
                                        {room.studentCount} {room.studentCount === 1 ? "student" : "students"} connected
                                    </span>
                                    {room.awayCount > 0 && (
                                        <span className="flex items-center gap-1">
                                            <UserRoundX className="size-4" aria-hidden="true" />
                                            {room.awayCount} away
                                        </span>
                                    )}
                                    {startedAgo && <span>Started {startedAgo}</span>}
                                    <span>{room.teacherConnected ? "Open in another tab" : "You're not in the room"}</span>
                                </p>
                                {room.closesAt && (
                                    <p className="text-sm font-semibold text-accent">
                                        Closes on its own {until(room.closesAt, now)} unless you rejoin. Everyone's work will be saved to Previous activities.
                                    </p>
                                )}
                                {room.expired && (
                                    <p className="text-sm text-brand/70">
                                        Past its hour: new students can't join, but anyone already in it can come back.
                                    </p>
                                )}
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <Link
                                    to={`/rooms/${room.code}`}
                                    className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand/90"
                                >
                                    <DoorOpen className="size-4" aria-hidden="true" />
                                    Rejoin room
                                </Link>
                                <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-lg border border-brand/30 px-4 py-2 text-brand cursor-pointer hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={ending === room.code}
                                    onClick={() => endRoom(room)}
                                >
                                    <X className="size-4" aria-hidden="true" />
                                    {ending === room.code ? "Ending…" : "End room"}
                                </button>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
