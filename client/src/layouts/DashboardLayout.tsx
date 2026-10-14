import { Outlet } from "react-router-dom"
import useAuth from "../hooks/useAuth"
import Footer from "../components/Footer"
// Shared frame for the signed-in area (/dashboard). Both roles land here;
// the index page decides whether to show the student or teacher dashboard.
export default function DashboardLayout() {
    const { auth, logout } = useAuth()

    return(
        <div className="min-h-screen flex flex-col bg-white text-black">
            <header className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
                
                {auth && (
                    <span className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                            {auth.user.name} · {auth.user.role}
                        </span>
                        <button
                            type="button"
                            className="rounded-lg border border-gray-300 px-3 py-1 text-gray-900 cursor-pointer hover:bg-neutral-100"
                            onClick={logout}
                        >
                            Logout
                        </button>
                    </span>
                )}
            </header>
            {/* TODO: dashboard menu (Home, Templates, Notes, Settings) goes here. */}
            <main className="flex-1 p-6">
                <Outlet />
            </main>
            <Footer className="min-h-[8vh] flex-shrink-0"/>
        </div>
    )
}
