import { FormEvent, useState } from "react"
import { useNavigate } from "react-router-dom"

// The search box in the dashboard header. Searching opens the results page,
// which lists the teacher's activities that match. Notes will be searched there too.
export default function DashboardSearch() {
    const navigate = useNavigate()
    const [query, setQuery] = useState("")

    // The box empties after a search, so the placeholder shows again.
    function handleSubmit(e : FormEvent){
        e.preventDefault()
        const trimmed = query.trim()
        if (trimmed === "") return
        setQuery("")
        navigate(`/dashboard/search?q=${encodeURIComponent(trimmed)}`)
    }

    return (
        <form role="search" className="relative w-full max-w-xl" onSubmit={handleSubmit}>
            {/* The icon sits inside the box, so it stays visible while typing. */}
            {/* An SVG instead of the 🔍 emoji, because emoji ignore text color. */}
            <svg className="pointer-events-none absolute inset-y-0 left-4 my-auto h-5 w-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <input
                type="search"
                className="w-full rounded-lg border border-gray-300 py-3 pl-12 pr-5 text-lg text-black focus:border-indigo-600 focus:outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for activities or notes"
                aria-label="Search for activities or notes"
            />
        </form>
    )
}
