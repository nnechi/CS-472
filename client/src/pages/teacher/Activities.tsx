import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import useAuth from "../../hooks/useAuth"
import Activity from "../../components/Activity"
import { NoteIcon } from "../../components/ActivitySVGs"
import { deleteActivity, listActivities } from "../../api"
import type { ActivitySummary } from "../../types"

// How many activities are shown on one page.
const PAGE_SIZE = 5

// The order the activity list can be shown in.
type SortOrder = "newest" | "oldest" | "az" | "za"

const SORT_LABELS: Record<SortOrder, string> = {
    newest: "Newest-Oldest",
    oldest: "Oldest-Newest",
    az: "A-Z",
    za: "Z-A",
}

// Returns a sorted copy of the activities. The server sends them A to Z, so each order is worked out here.
function sortActivities(list: ActivitySummary[], order: SortOrder): ActivitySummary[] {
    const byDate = (a: ActivitySummary) => Date.parse(a.createdAt) || 0
    const sorted = [...list]
    if (order === "newest") sorted.sort((a, b) => byDate(b) - byDate(a))
    else if (order === "oldest") sorted.sort((a, b) => byDate(a) - byDate(b))
    else if (order === "az") sorted.sort((a, b) => a.name.localeCompare(b.name))
    else sorted.sort((a, b) => b.name.localeCompare(a.name))
    return sorted
}

// /dashboard/activities -- the teacher's saved activities, with a button to make a new one.
export default function Activities() {
    const { auth } = useAuth()
    const navigate = useNavigate()

    // When a search result is clicked, the URL carries that activity's id (?activity=...), so it can be highlighted
    const [params] = useSearchParams()
    const highlightId = params.get("activity")

    // Create activities array to store each activity that the user has in the database. Each activity is represented
    // by an "ActivitySummary" object, which contains an id for the activity and the activity name
    // Default state is either an empty activities array or null - it starts as null when the activities list is not loaded yet
    // and switches to an empty array when it is loaded => does this to differentiate between an empty array and an unloaded array
    const [activities, setActivities] = useState<ActivitySummary[] | null>(null)

    // How the list is sorted. Newest to oldest is the default.
    const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
    // Whether the sort menu is open, so its arrow can point up while it is open.
    const [sortOpen, setSortOpen] = useState(false)
    const sortRef = useRef<HTMLDivElement>(null)

    // Closes the sort menu when the user clicks anywhere outside it.
    useEffect(() => {
        if (!sortOpen) return
        function closeIfOutside(event: MouseEvent) {
            if (sortRef.current && !sortRef.current.contains(event.target as Node)) setSortOpen(false)
        }
        document.addEventListener("mousedown", closeIfOutside)
        return () => document.removeEventListener("mousedown", closeIfOutside)
    }, [sortOpen])
    // The activities in the chosen order. Null while they are still loading.
    const sortedActivities = useMemo(
        () => (activities === null ? null : sortActivities(activities, sortOrder)),
        [activities, sortOrder]
    )
    // Which page of activities is showing. Each page holds PAGE_SIZE activities.
    const [page, setPage] = useState(0)
    const pageCount = Math.max(1, Math.ceil((sortedActivities?.length ?? 0) / PAGE_SIZE))
    // Keeps the page in range when a delete leaves fewer pages.
    const currentPage = Math.min(page, pageCount - 1)
    const pageActivities = sortedActivities?.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE) ?? null
    
    // Set an error string for when the list fails to load. Defaults to blank, as an error has not occurred yet
    const [listError, setListError] = useState("")

    // The id of the activity whose ... menu is open. Only one menu can be open at a time.
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

    // This loads the teacher's activities from the server, runs when the dashboard is first rendered
    // This also runs when the auth changes
    useEffect(() => {
        // If the auth is null (aka no user logged in yet) do nothing
        if (!auth) return

        // Represents if the request needs to be canceled because the user navigated away from the page while the server was still responding
        // or a new request has been made
        let cancelled = false

        // listActivities is an API call to the server that returns a Promise - this Promise holds an array of ActivitySummary objects
        // Essentially, this function returns the array of activities for a user - passes in the user's id to know which user to look up
        listActivities(auth.user.id)
            // .then() runs when the server responds
            // This calls the setActivities function to change the state of the activities array to match the array from the server (triggers rerender as well)
            .then((found) => { if (!cancelled) setActivities(found) })
            
            // .catch() runs when the server request fails
            // Sets the error message based on the error message from the Error object (given by listActivities function)
            .catch((e) => {
                console.error(e)
                if (!cancelled) setListError(e instanceof Error ? e.message : "Could not load your activities.")
            })

        // Cleanup function that runs when the component unmounts
        // Unmounts => component is removed and its HTML is taken off the page
        return () => { cancelled = true }
    }, [auth])

    // Once the list is loaded, scroll the highlighted activity into view
    useEffect(() => {
        if (!highlightId || activities === null) return
        document.getElementById(`activity-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, [activities, highlightId])

    // Determine what should be displayed in activities box
    function displayActivities(){
        // If there was an error getting the activites, display the error msg in red text
        if (listError)
            return <p className="text-red-600">{listError}</p>

        // If activities is null, this means the activities are still loading. Display a "loading" msg
        else if (sortedActivities === null)
            return <p className="text-gray-600">Loading your activities...</p>

        // If activities is an empty array, this means no activities have been created yet. Display a msg telling the user to create an activity
        else if (sortedActivities.length === 0)
            return <p className="text-gray-600">You haven't made any activities yet. Click "Create an Activity" to create your first activity.</p>

        // Otherwise, activities array is loaded and has activities to display, so display the Activity components
        return (
            <>
                {pageActivities?.map((a) => (
                    <div
                        key={a.id}
                        id={`activity-${a.id}`}
                        className={a.id === highlightId ? "rounded-lg ring-2 ring-indigo-600" : undefined}
                    >
                        <Activity
                            id={a.id}
                            name={a.name}
                            questionCount={a.questionCount}
                            createdAt={a.createdAt}
                            onDelete={() => handleDelete(a.id)}
                            menuOpen={openMenuId === a.id}
                            onMenuToggle={() => setOpenMenuId((current) => current === a.id ? null : a.id)}
                            onMenuClose={() => setOpenMenuId(null)}
                        />
                    </div>
                ))}
                {sortedActivities.length > PAGE_SIZE && (
                    <nav aria-label="Activity pages" className="mt-6 flex items-center justify-center gap-4 text-gray-900">
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

    // Deletes the activity from the database, then removes it from the list on screen
    // If the server request fails, the error is thrown so the Activity component can show it
    async function handleDelete(activityId: string){
        if (!auth) return
        await deleteActivity(activityId, auth.user.id)
        setActivities((current) => current?.filter((a) => a.id !== activityId) ?? null)
    }

    return (
        <>
            <section className="flex h-full flex-col">
                <div className="mt-8 flex items-center justify-between gap-4">
                    <h1 className="text-4xl font-bold">Your Activities</h1>
                    {/* Clicking the icon and the text opens the create page. */}
                    <button
                        type="button"
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-neutral-100"
                        onClick={() => navigate("/dashboard/create-activity")}
                    >
                        <NoteIcon />
                        <span>Create a new activity</span>
                    </button>
                </div>

                <div className="mt-4 flex items-center gap-3 pl-4">
                    <label htmlFor="activity-sort" className="text-gray-900">sort by:</label>
                    <div ref={sortRef} className="relative">
                        <button
                            type="button"
                            id="activity-sort"
                            aria-haspopup="listbox"
                            aria-expanded={sortOpen}
                            onClick={() => setSortOpen((open) => !open)}
                            className="flex cursor-pointer items-center gap-6 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                        >
                            <span>{SORT_LABELS[sortOrder]}</span>
                            <span aria-hidden="true">{sortOpen ? "▴" : "▾"}</span>
                        </button>
                        {sortOpen && (
                            <ul role="listbox" aria-labelledby="activity-sort" className="absolute left-0 top-full z-20 mt-2 flex w-56 flex-col rounded-lg border border-brand bg-white p-2 shadow-md">
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

                <div className="mt-4 min-h-60 flex-1 overflow-y-auto rounded-lg p-4 space-y-4">
                    {displayActivities()}
                </div>
            </section>
        </>
    )
}
