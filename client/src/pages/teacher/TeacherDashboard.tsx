import { Link } from "react-router-dom"
import useAuth from "../../hooks/useAuth"

// /dashboard -- the teacher's home page. Activities and notes are in the ☰ menu.
export default function TeacherDashboard() {
    const { auth } = useAuth()

    return (
        <section className="mt-8 flex flex-col gap-8">
            <h1 className="text-6xl font-bold">Welcome{auth ? `, ${auth.user.name}!` : ""}</h1>
            <div className="flex flex-wrap gap-4 text-lg">
                <Link
                    to="/dashboard/activities"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-neutral-100"
                >
                    Go to activities
                </Link>
                <Link
                    to="/dashboard/notes"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-neutral-100"
                >
                    Go to notes
                </Link>
            </div>
        </section>
    )
}
