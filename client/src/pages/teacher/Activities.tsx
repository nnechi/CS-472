import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import useAuth from "../../hooks/useAuth"
import Activity from "../../components/Activity"
import { deleteActivity, listActivities } from "../../api"
import type { ActivitySummary } from "../../types"

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
    
    // Set an error string for when the list fails to load. Defaults to blank, as an error has not occurred yet
    const [listError, setListError] = useState("")

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
        else if (activities === null)
            return <p className="text-gray-600">Loading your activities...</p>

        // If activities is an empty array, this means no activities have been created yet. Display a msg telling the user to create an activity
        else if (activities.length === 0)
            return <p className="text-gray-600">You haven't made any activities yet. Click "Create an Activity" to create your first activity.</p>

        // Otherwise, activities array is loaded and has activities to display, so display the Activity components
        return activities.map((a) => (
            <div
                key={a.id}
                id={`activity-${a.id}`}
                className={a.id === highlightId ? "rounded-lg ring-2 ring-indigo-600" : undefined}
            >
                <Activity id={a.id} name={a.name} onDelete={() => handleDelete(a.id)} />
            </div>
        ))
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
            <section>
                <div className="mt-8 flex items-center justify-between">
                    <h1 className="text-4xl font-bold">Your Activities</h1>
                    <button
                        type="button"
                        className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                        onClick={() => navigate("/dashboard/create-activity")}
                    >
                        Create New Activity
                    </button>
                </div>

                <div className="mt-4 rounded-lg bg-gray-100 p-4 h-150 overflow-y-auto space-y-4">
                    {displayActivities()}
                </div>
            </section>
        </>
    )
}
