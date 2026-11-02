import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { listActivities } from "../../api"
import useAuth from "../../hooks/useAuth"
import type { ActivitySummary } from "../../types"

// /dashboard/search?q=... -- the teacher's activities whose names match the search.
// Notes will be listed here once they are saved to the database.
export default function SearchResults() {
    const { auth } = useAuth()
    const [params] = useSearchParams()
    const query = (params.get("q") ?? "").trim()
    const [activities, setActivities] = useState<ActivitySummary[] | null>(null)
    const [loadError, setLoadError] = useState("")

    useEffect(() => {
        if (!auth) return
        let cancelled = false
        listActivities(auth.user.id)
            .then((found) => { if (!cancelled) setActivities(found) })
            .catch((err) => {
                if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load your activities.")
            })
        return () => { cancelled = true }
    }, [auth?.user.id])

    function displayResults(){
        if (loadError) return <p role="alert" className="text-red-600">{loadError}</p>
        if (activities === null) return <p className="text-gray-600">Searching...</p>

        const matches = activities.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
        if (matches.length === 0) {
            return <p className="text-gray-600">There were no results for "{query}"</p>
        }
        return (
            <ul className="flex flex-col gap-2">
                {matches.map((a) => (
                    <li key={a.id}>
                        {/* Opens the activities page with this activity scrolled into view and highlighted. */}
                        <Link
                            to={`/dashboard/activities?activity=${a.id}`}
                            className="block rounded-lg border border-gray-300 px-3 py-2 text-base hover:bg-neutral-100"
                        >
                            {a.name}
                        </Link>
                    </li>
                ))}
            </ul>
        )
    }

    return (
        <section className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold">{query === "" ? "Search results" : `Search results for "${query}"`}</h1>
            {query === ""
                ? <p className="text-gray-600">Type something in the search bar to find activities.</p>
                : displayResults()}
        </section>
    )
}
