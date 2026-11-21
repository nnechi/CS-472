import { Link } from "react-router-dom"

// Shown inside the dashboard layout when a /dashboard/... URL does not match a page.
// The menu and header stay on screen, so the teacher can go somewhere else.
export default function DashboardNotFound() {
    return (
        <section className="flex min-h-[70vh] flex-col items-center justify-start gap-6 pt-[15vh] text-center">
            <h1 className="flex items-center gap-3 text-4xl font-bold">
                We can't seem to find that page
                <svg viewBox="0 0 24 24" className="h-10 w-10 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 9h.01" strokeWidth="3" />
                    <path d="M15 9h.01" strokeWidth="3" />
                    <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                </svg>
            </h1>
            <p className="text-xl text-gray-600">It might be an old link or the page might have been removed</p>
            <div>
                <Link
                    to="/dashboard"
                    className="inline-block rounded-xl border-2 border-brand bg-pop/25 px-6 py-3 text-xl text-brand hover:bg-pop/40"
                >
                    Back to dashboard
                </Link>
            </div>
        </section>
    )
}
