import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { NoteIcon, PencilIcon, PlayIcon, TrashIcon } from "./ActivitySVGs"

interface ActivityProps {
    // The activity's database id, used to link it to a new room
    id: string
    name: string
    // How many questions the activity has, shown under the name
    questionCount: number
    // ISO timestamp of when the activity was made, shown under the name
    createdAt: string
    // Called when the user confirms they want to delete this activity. Throws if the delete fails.
    onDelete: () => Promise<void>
    // Whether this activity's ... menu is open. The list keeps only one menu open at a time.
    menuOpen: boolean
    // Opens this activity's menu, or closes it if it is already open
    onMenuToggle: () => void
    // Closes this activity's menu
    onMenuClose: () => void
}

export default function Activity({ id, name, questionCount, createdAt, onDelete, menuOpen, onMenuToggle, onMenuClose } : ActivityProps){
    const navigate = useNavigate()

    // Boolean to represent if the activity is in the process of deleting
    // True while the delete request is waiting on the server, so the button can't be clicked twice
    // False when there is no active delete request
    const [deleting, setDeleting] = useState(false)

    // String to represent error msg
    const [deleteError, setDeleteError] = useState("")

    // The ... button's wrapper, measured to place the menu on the page
    const moreRef = useRef<HTMLDivElement>(null)

    // Where the menu is drawn on the screen. It is fixed to the page, so the activity list's scrolling box can't clip it.
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

    // Opens or closes the menu. When it opens, puts it below the ... button, or above it when there isn't room below.
    function toggleMenu(){
        if (!menuOpen && moreRef.current) {
            // The menu's width (w-52) and about three buttons tall, plus padding and the gap
            const menuWidth = 208
            const menuHeight = 160
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
        const close = onMenuClose
        window.addEventListener("scroll", close, true)
        window.addEventListener("resize", close)
        // A scroll wheel or touch move closes it even when the page can't move, so the menu never stays behind.
        window.addEventListener("wheel", close, { passive: true })
        window.addEventListener("touchmove", close, { passive: true })
        return () => {
            window.removeEventListener("scroll", close, true)
            window.removeEventListener("resize", close)
            window.removeEventListener("wheel", close)
            window.removeEventListener("touchmove", close)
        }
    }, [menuOpen, onMenuClose])

    // Function to handle the deleting process
    async function handleDelete(){
        // Creates a popup window to confirm the delete. If they do not confirm the delete, then do nothing
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return

        // Deletion has been confirmed, so delete request has started. Set deleting boolean to true
        setDeleting(true)
        setDeleteError("")

        // Try doing the delete 
        try {
            await onDelete()

        // If delete errors, set the error msg and cancel the delete request (set deleting to false)
        } catch (e) {
            console.error(e)
            setDeleteError(e instanceof Error ? e.message : "Could not delete the activity.")
            setDeleting(false)
        }
    }

    // Goes to the room creation page with this activity already chosen.
    // That page links the activity to the new room code in the background.
    function startRoom(){
        navigate("/dashboard/room-creation", { state: { activityId: id } })
    }

    return (
        <div className="group rounded-lg p-4 hover:bg-brand-light">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white group-hover:bg-brand-light">
                        <NoteIcon className="text-brand" />
                    </span>
                    <div>
                        <p className="text-lg">{name}</p>
                        <p className="text-sm text-gray-600">
                            {questionCount} {questionCount === 1 ? "question" : "questions"} · Created {new Date(createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                    </div>
                </div>
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
                    {/* Shows "More" under the button on hover, styled like the closed menu's tooltips. Hidden while the menu is open. */}
                    {!menuOpen && (
                        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-brand px-2 py-1 text-sm text-white group-hover/more:block" aria-hidden="true">More</span>
                    )}
                    {/* Start Room, Edit and Delete, stacked in a white box. Opens below the ... button, or above it when there isn't room. */}
                    {menuOpen && (
                        <div style={menuPosition} className="fixed z-50 flex w-52 flex-col gap-2 rounded-lg border border-brand bg-white p-2 shadow-md">
                            <button
                                type="button"
                                className="rounded-lg whitespace-nowrap px-3 py-2 text-left text-lg text-gray-900 cursor-pointer hover:bg-neutral-100"
                                onClick={startRoom}
                            >
                                <span className="flex items-center gap-2">
                                    <PlayIcon />
                                    Start Room
                                </span>
                            </button>
                            <button
                                type="button"
                                className="rounded-lg whitespace-nowrap px-3 py-2 text-left text-lg text-gray-900 cursor-pointer hover:bg-neutral-100"
                            >
                                <span className="flex items-center gap-2">
                                    <PencilIcon />
                                    Edit
                                </span>
                            </button>
                            <button
                                type="button"
                                className="rounded-lg whitespace-nowrap px-3 py-2 text-left text-lg text-red-800 cursor-pointer hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={handleDelete}
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
            {deleteError && <p className="mt-2 text-red-600">{deleteError}</p>}
        </div>
    )
}
