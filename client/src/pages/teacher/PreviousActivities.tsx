import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { HistoryIcon } from "../../components/MenuIcons"
import { TrashIcon } from "../../components/ActivitySVGs"
import { deletePastRoom, listPastRooms, SessionEndedError } from "../../api"
import useAuth from "../../hooks/useAuth"
import type { PastRoomSummary } from "../../types"

// The order the rooms can be shown in.
type SortOrder = "newest" | "oldest" | "az" | "za"

const SORT_LABELS: Record<SortOrder, string> = {
    newest: "Newest-Oldest",
    oldest: "Oldest-Newest",
    az: "A-Z",
    za: "Z-A",
}

// Returns a sorted copy of the rooms. Newest and oldest go by when the room ended.
function sortRooms(list: PastRoomSummary[], order: SortOrder): PastRoomSummary[] {
    const byDate = (r: PastRoomSummary) => Date.parse(r.endedAt) || 0
    const byName = (r: PastRoomSummary) => r.activityName || "Activity"
    const sorted = [...list]
    if (order === "newest") sorted.sort((a, b) => byDate(b) - byDate(a))
    else if (order === "oldest") sorted.sort((a, b) => byDate(a) - byDate(b))
    else if (order === "az") sorted.sort((a, b) => byName(a).localeCompare(byName(b)))
    else sorted.sort((a, b) => byName(b).localeCompare(byName(a)))
    return sorted
}

// How many rooms are shown on one page.
const PAGE_SIZE = 5

// An eye: used for the View room item in the row menu.
function EyeIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}

// /dashboard/previous-activities -- rooms this teacher ran that have ended, newest first.
// Clicking one opens the read-only teacher room view at /previous-rooms/<code>.
export default function PreviousActivities() {
    // null while loading, so an empty list and an unloaded list look different
    const [rooms, setRooms] = useState<PastRoomSummary[] | null>(null)
    const [listError, setListError] = useState("")
    const { setAuth } = useAuth()

    // How the list is sorted. Newest-Oldest is the default.
    const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
    // Whether the sort menu is open, so its arrow can point up while it is open.
    const [sortOpen, setSortOpen] = useState(false)
    const sortRef = useRef<HTMLDivElement>(null)
    // The rooms in the chosen order. Null while they are still loading.
    const sortedRooms = useMemo(
        () => (rooms === null ? null : sortRooms(rooms, sortOrder)),
        [rooms, sortOrder]
    )

    // Which page of rooms is showing. Each page holds PAGE_SIZE rooms.
    const [page, setPage] = useState(0)
    const pageCount = Math.max(1, Math.ceil((sortedRooms?.length ?? 0) / PAGE_SIZE))
    // Keeps the page in range when a delete leaves fewer pages.
    const currentPage = Math.min(page, pageCount - 1)
    const pageRooms = sortedRooms?.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE) ?? null

    // Closes the sort menu when the user clicks anywhere outside it.
    useEffect(() => {
        if (!sortOpen) return
        function closeIfOutside(event: MouseEvent) {
            if (sortRef.current && !sortRef.current.contains(event.target as Node)) setSortOpen(false)
        }
        document.addEventListener("mousedown", closeIfOutside)
        return () => document.removeEventListener("mousedown", closeIfOutside)
    }, [sortOpen])

    // The room whose ... menu is open. Only one menu can be open at a time.
    const [openMenuCode, setOpenMenuCode] = useState<string | null>(null)
    // The room whose delete request is waiting on the server.
    const [deletingCode, setDeletingCode] = useState<string | null>(null)
    // Delete errors, keyed by room code, shown under that room's row.
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

    // Asks first, then deletes the room and removes it from the list on screen.
    async function handleDelete(room: PastRoomSummary) {
        const name = room.activityName || "Activity"
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return

        setDeletingCode(room.code)
        setRowErrors((current) => ({ ...current, [room.code]: "" }))
        try {
            await deletePastRoom(room.code)
            setRooms((current) => current?.filter((r) => r.code !== room.code) ?? null)
            setOpenMenuCode(null)
        } catch (e) {
            if (e instanceof SessionEndedError) {
                setAuth(null)
                return
            }
            console.error(e)
            setRowErrors((current) => ({ ...current, [room.code]: e instanceof Error ? e.message : "Could not delete that room." }))
        } finally {
            setDeletingCode(null)
        }
    }
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

        if (sortedRooms === null)
            return <p className="text-gray-600">Loading your previous activities...</p>

        if (sortedRooms.length === 0)
            return <p className="text-gray-600">No previous activities yet. Rooms you end will show up here.</p>

        return (
            <>
                <ul className="space-y-4">
                    {pageRooms?.map((r) => (
                        <li key={r.code}>
                            <PreviousRoomRow
                                room={r}
                                menuOpen={openMenuCode === r.code}
                                onMenuToggle={() => setOpenMenuCode((current) => current === r.code ? null : r.code)}
                                onMenuClose={() => setOpenMenuCode(null)}
                                deleting={deletingCode === r.code}
                                error={rowErrors[r.code] ?? ""}
                                onDelete={() => handleDelete(r)}
                            />
                        </li>
                    ))}
                </ul>
                {sortedRooms.length > PAGE_SIZE && (
                    <nav aria-label="Previous activities pages" className="mt-6 flex items-center justify-center gap-4 text-gray-900">
                        <button
                            type="button"
                            aria-label="Previous page"
                            onClick={() => setPage(currentPage - 1)}
                            disabled={currentPage === 0}
                            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1 text-xl disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            &lt;
                        </button>
                        <span>Page {currentPage + 1} of {pageCount}</span>
                        <button
                            type="button"
                            aria-label="Next page"
                            onClick={() => setPage(currentPage + 1)}
                            disabled={currentPage >= pageCount - 1}
                            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1 text-xl disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            &gt;
                        </button>
                    </nav>
                )}
            </>
        )
    }

    return (
        <section className="flex h-full flex-col">
            <h1 className="mt-8 text-4xl font-bold">Previous Activities</h1>
            <div className="mt-4 flex items-center gap-3 pl-4">
                <label htmlFor="room-sort" className="text-gray-900">sort by:</label>
                <div ref={sortRef} className="relative">
                    <button
                        type="button"
                        id="room-sort"
                        aria-haspopup="listbox"
                        aria-expanded={sortOpen}
                        onClick={() => setSortOpen((open) => !open)}
                        className="flex cursor-pointer items-center gap-6 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                    >
                        <span>{SORT_LABELS[sortOrder]}</span>
                        <span aria-hidden="true">{sortOpen ? "▴" : "▾"}</span>
                    </button>
                    {sortOpen && (
                        <ul role="listbox" aria-labelledby="room-sort" className="absolute left-0 top-full z-20 mt-2 flex w-56 flex-col rounded-lg border border-brand bg-white p-2 shadow-md">
                            {(Object.keys(SORT_LABELS) as SortOrder[]).map((order) => (
                                <li
                                    key={order}
                                    role="option"
                                    aria-selected={order === sortOrder}
                                    onClick={() => {
                                        setSortOrder(order)
                                        setPage(0)
                                        setSortOpen(false)
                                    }}
                                    className={`cursor-pointer rounded-md px-3 py-2 text-brand hover:bg-[#ccc9f7] ${order === sortOrder ? "font-semibold" : ""}`}
                                >
                                    {SORT_LABELS[order]}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            <div className="mt-4 min-h-60 flex-1 overflow-y-auto rounded-lg p-4">
                {displayRooms()}
            </div>
        </section>
    )
}

interface PreviousRoomRowProps {
    room: PastRoomSummary
    menuOpen: boolean
    onMenuToggle: () => void
    onMenuClose: () => void
    deleting: boolean
    error: string
    onDelete: () => void
}

// One ended room: a link to its view, and a ... button whose menu has View room and Delete.
function PreviousRoomRow({ room, menuOpen, onMenuToggle, onMenuClose, deleting, error, onDelete }: PreviousRoomRowProps) {
    const roomPath = `/previous-rooms/${encodeURIComponent(room.code)}`

    // The ... button's wrapper, measured to place the menu on the page
    const moreRef = useRef<HTMLDivElement>(null)
    // The menu is fixed to the page, so the list's scrolling box can't clip it.
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

    // Opens or closes the menu. Opens below the ... button, or above it when there isn't room below.
    function toggleMenu() {
        if (!menuOpen && moreRef.current) {
            // The menu's width (w-52) and about two items tall, plus padding and the gap
            const menuWidth = 208
            const menuHeight = 120
            const rect = moreRef.current.getBoundingClientRect()
            const opensUp = window.innerHeight - rect.bottom < menuHeight
            setMenuPosition({
                top: opensUp ? rect.top - menuHeight - 8 : rect.bottom + 8,
                left: rect.right - menuWidth,
            })
        }
        onMenuToggle()
    }

    // The menu is fixed on the screen, so it would drift away from the button if the page scrolls. Close it instead.
    useEffect(() => {
        if (!menuOpen) return
        window.addEventListener("scroll", onMenuClose, true)
        window.addEventListener("resize", onMenuClose)
        window.addEventListener("wheel", onMenuClose, { passive: true })
        window.addEventListener("touchmove", onMenuClose, { passive: true })
        return () => {
            window.removeEventListener("scroll", onMenuClose, true)
            window.removeEventListener("resize", onMenuClose)
            window.removeEventListener("wheel", onMenuClose)
            window.removeEventListener("touchmove", onMenuClose)
        }
    }, [menuOpen, onMenuClose])

    return (
        <div className="group rounded-lg p-4 hover:bg-brand-light">
            <div className="flex items-center justify-between gap-3">
                <Link to={roomPath} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white group-hover:bg-brand-light">
                        <HistoryIcon className="h-6 w-6 text-brand" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-lg">{room.activityName || "Activity"}</p>
                        <p className="text-sm text-gray-600">
                            Room {room.code} · Ended {new Date(room.endedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {room.studentCount} {room.studentCount === 1 ? "student" : "students"}
                        </p>
                    </div>
                </Link>

                <div ref={moreRef} className="group/more relative">
                    <button
                        type="button"
                        className="relative isolate flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-gray-600 cursor-pointer before:absolute before:inset-0 before:-z-10 before:translate-y-1 before:rounded-full before:content-[''] hover:text-black hover:before:bg-neutral-100"
                        onClick={toggleMenu}
                        aria-label="More options"
                        aria-expanded={menuOpen}
                    >
                        ...
                    </button>
                    {/* Shows "More" under the button on hover. Hidden while the menu is open. */}
                    {!menuOpen && (
                        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-brand px-2 py-1 text-sm text-white group-hover/more:block" aria-hidden="true">More</span>
                    )}
                    {/* View room and Delete, stacked in a white box. Opens below the ... button, or above it when there isn't room. */}
                    {menuOpen && (
                        <div style={menuPosition} className="fixed z-50 flex w-52 flex-col gap-2 rounded-lg border border-brand bg-white p-2 shadow-md">
                            <Link
                                to={roomPath}
                                className="rounded-lg whitespace-nowrap px-3 py-2 text-left text-lg text-gray-900 cursor-pointer hover:bg-neutral-100"
                                onClick={onMenuClose}
                            >
                                <span className="flex items-center gap-2">
                                    <EyeIcon />
                                    View room
                                </span>
                            </Link>
                            <button
                                type="button"
                                className="rounded-lg whitespace-nowrap px-3 py-2 text-left text-lg text-red-800 cursor-pointer hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={onDelete}
                                disabled={deleting}
                            >
                                <span className="flex items-center gap-2">
                                    <TrashIcon />
                                    {deleting ? "Deleting..." : "Delete"}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {error && <p className="mt-2 text-red-600">{error}</p>}
        </div>
    )
}
