import { useState } from "react"
import { useNavigate } from "react-router-dom"

interface ActivityProps {
    name: string
    // Called when the user confirms they want to delete this activity. Throws if the delete fails.
    onDelete: () => Promise<void>
}

export default function Activity({ name, onDelete } : ActivityProps){
    const navigate = useNavigate()

    // Boolean to represent if the activity is in the process of deleting
    // True while the delete request is waiting on the server, so the button can't be clicked twice
    // False when there is no active delete request
    const [deleting, setDeleting] = useState(false)

    // String to represent error msg
    const [deleteError, setDeleteError] = useState("")

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

    return (
        <div className="rounded-lg border border-gray-400 p-4">
            <div className="flex items-center justify-between">
                <p className="text-lg">{name}</p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="text-lg rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                        onClick={() => navigate("/dashboard/room-creation")}
                    >
                        Start Room
                    </button>
                    <button
                        type="button"
                        className="text-lg rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handleDelete}
                        disabled={deleting}
                    >
                        {deleting ? "Deleting..." : "Delete Activity"}
                    </button>
                </div>
            </div>
            {deleteError && <p className="mt-2 text-red-600">{deleteError}</p>}
        </div>
    )
}
