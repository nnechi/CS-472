import { Link } from "react-router-dom"

// Shown inside the dashboard layout when a /dashboard/... URL does not match a page.
// The menu and header stay on screen, so the teacher can go somewhere else.
export default function DashboardNotFound() {
    return (
        <section className="flex min-h-[70vh] flex-col items-center justify-start gap-6 pt-[15vh] text-center">
            <h1 className="text-4xl font-bold">We can't seem to find that page</h1>
            <p className="text-gray-600">It might be an old link or the page might have been removed</p>
            <div>
                <Link
                    to="/dashboard"
                    className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-neutral-100"
                >
                    Back to dashboard
                </Link>
            </div>
        </section>
    )
}
