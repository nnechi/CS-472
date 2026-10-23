import { FormEvent, useState } from "react"
import { useNavigate } from "react-router-dom"
import { createActivity } from "../../api"
import useAuth from "../../hooks/useAuth"
import { ACTIVITY_MAX_LENGTH, ACTIVITY_NAME_MAX_LENGTH } from "../../types"

// /dashboard/create-activity -- a teacher writes an activity and saves it under
// their account. Only that teacher can use it in their rooms.
export default function CreateActivity(){
    const navigate = useNavigate()
    const { auth } = useAuth()
    const [name, setName] = useState("")
    const [data, setData] = useState("")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(e : FormEvent){
        e.preventDefault()
        if (!auth || saving) return
        setSaving(true)
        setError("")
        try {
            await createActivity(auth.user.id, name, data)
            navigate("/dashboard")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the activity.")
            setSaving(false)
        }
    }

    return (
        <form className="mt-8 flex flex-col gap-6" onSubmit={handleSubmit}>
            <h1 className="text-4xl font-bold">Create an activity</h1>

            <label className="flex flex-col gap-1 text-sm text-gray-600">
                Name
                <input
                    className="rounded-lg border border-gray-300 px-3 py-2 text-base text-black focus:border-indigo-600 focus:outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name your students will see"
                    maxLength={ACTIVITY_NAME_MAX_LENGTH}
                    required
                />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-600">
                Activity
                <textarea
                    className="min-h-64 rounded-lg border border-gray-300 p-3 text-base text-black focus:border-indigo-600 focus:outline-none"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    placeholder="Write the activity students will work on..."
                    maxLength={ACTIVITY_MAX_LENGTH}
                />
            </label>

            {error && <p role="alert" className="text-red-600">{error}</p>}

            <div className="flex gap-3">
                <button
                    type="submit"
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={saving}
                >
                    {saving ? "Saving..." : "Save activity"}
                </button>
                <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                    onClick={() => navigate("/dashboard")}
                >
                    Cancel
                </button>
            </div>
        </form>
    )
}
