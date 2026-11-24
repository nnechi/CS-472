import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { NotebookPen } from "lucide-react"
import { NoteIcon, PencilIcon, PlayIcon, TrashIcon } from "./ActivitySVGs"
import TeacherNotes from "./TeacherNotes"
import { getActivityNote, saveActivityNote } from "../api"
import ActivityPreview, { ACTIVITY_PREVIEW_CLASS, ACTIVITY_PREVIEW_COLLISION_PADDING } from "./ActivityPreview"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ActivitySummary } from "../types"

interface ActivityProps {
    // The activity as listed by the server. Its id links it to a new room; the rest is shown in the row and the hover preview.
    activity: ActivitySummary
    // Called when the user confirms they want to delete this activity. Throws if the delete fails.
    onDelete: () => Promise<void>
    // Whether this activity's ... menu is open. The list keeps only one menu open at a time.
    menuOpen: boolean
    // Opens this activity's menu, or closes it if it is already open
    onMenuToggle: () => void
    // Closes this activity's menu
    onMenuClose: () => void
    // Whether this activity's notes are open under it, and the menu item that opens or closes them.
    // Without onNotesToggle, the menu has no Notes item.
    notesOpen?: boolean
    onNotesToggle?: () => void
}

export default function Activity({ activity, onDelete, menuOpen, onMenuToggle, onMenuClose, notesOpen = false, onNotesToggle } : ActivityProps){
    const { id, name, questionCount, createdAt } = activity
    const navigate = useNavigate()

    // Whether the hover preview wants to be open. It is kept closed while the ... menu is open, so the two never overlap.
    const [previewOpen, setPreviewOpen] = useState(false)

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
            // The menu's width (w-52) and about four buttons tall, plus padding and the gaps
            const menuWidth = 208
            const menuHeight = 216
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
        navigate("/room-creation", { state: { activityId: id } })
    }

    return (
        <div>
        {/* Hovering anywhere on the box shows the preview below it. It stays closed while the ... menu is open. */}
        <Popover open={previewOpen && !menuOpen} onOpenChange={setPreviewOpen}>
        <PopoverTrigger
            openOnHover
            delay={200}
            closeDelay={150}
            nativeButton={false}
            render={<div />}
            className="group rounded-lg p-4 hover:bg-brand-light data-popup-open:bg-brand-light"
        >
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
                {/* Clicks on the ... button and its menu stay here, so they don't also toggle the preview. */}
                <div ref={moreRef} className="group/more relative" onClick={(e) => e.stopPropagation()}>
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
                            {onNotesToggle && (
                                <button
                                    type="button"
                                    className="rounded-lg whitespace-nowrap px-3 py-2 text-left text-lg text-gray-900 cursor-pointer hover:bg-neutral-100"
                                    aria-expanded={notesOpen}
                                    onClick={() => {
                                        onNotesToggle()
                                        onMenuClose()
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        <NotebookPen className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                        {notesOpen ? "Hide Notes" : "Show Notes"}
                                    </span>
                                </button>
                            )}
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
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" collisionPadding={ACTIVITY_PREVIEW_COLLISION_PADDING} className={ACTIVITY_PREVIEW_CLASS}>
            <ActivityPreview activity={activity} />
        </PopoverContent>
        </Popover>
        {/* The teacher's private notes on this activity, saved as they type.
            Kept outside the hover area so typing in them doesn't open the preview on top of them. */}
        {notesOpen && (
            <div className="mx-4 mb-4 rounded-lg border border-brand/20 bg-white p-4">
                <TeacherNotes
                    title="Your notes on this activity"
                    description="Only you can see these. They're shown every time you use this activity."
                    noteKey={`activity:${id}`}
                    load={() => getActivityNote(id).then((note) => note.text)}
                    save={(text) => saveActivityNote(id, text)}
                />
            </div>
        )}
        </div>
    )
}
