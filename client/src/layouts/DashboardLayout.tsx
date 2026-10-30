import { useState } from "react"
import { Link, NavLink, Outlet } from "react-router-dom"
import useAuth from "../hooks/useAuth"
import DashboardSearch from "../components/DashboardSearch"
import UserAvatar from "../components/UserAvatar"
import shortLogo from "../assets/LittlePointers Logo/Short Logo.png"

// Menu items stack the icon above the text on small screens and sit side by side on laptop and larger.
const menuItemBase = "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-sm text-gray-900 hover:bg-neutral-100 md:flex-row md:gap-3 md:px-3 md:text-left md:text-lg"

//Originally had the teacherDashbooard but changed it to just DashboardLayout
export default function DashboardLayout() {
    const { auth, logout } = useAuth()
    // The menu starts open on laptop-sized screens (768px and up) and closed on small ones.
    // The ☰ button opens and closes it at every size.
    const [menuOpen, setMenuOpen] = useState(() => window.matchMedia("(min-width: 768px)").matches)

    // On laptop and larger, a closed menu shows only the icons. An open menu adds the words next to them.
    // The items and the menu's padding are the same in both states, so the icons never move.
    // On small screens the menu is hidden when closed, so it never shows only icons.
    const itemClass = menuItemBase
    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `${itemClass} ${isActive ? "bg-neutral-200 font-semibold" : ""}`
    const labelClass = menuOpen ? "" : "md:hidden"

    return(
        <div className="min-h-screen flex flex-col bg-white text-black">
            {/* The header has no left padding at any size, so the ☰ button and logo stay in the same place. The button lines up with the closed menu's edge. */}
            <header className="flex h-32 items-center justify-between gap-8 border-b border-gray-200 pr-8">
                <div className="flex h-20 items-center gap-0">
                    <button
                        type="button"
                        className="flex h-20 w-16 items-center justify-center rounded-lg px-0 text-5xl leading-none text-gray-900 cursor-pointer hover:bg-neutral-100"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        aria-controls="dashboard-menu"
                    >
                        ☰
                    </button>

                    {/* Short logo at every screen size. It goes back to the dashboard. */}
                    <Link to="/dashboard" aria-label="LittlePointers dashboard">
                        <img src={shortLogo} alt="" className="h-12" />
                    </Link>
                </div>

                <div className="flex flex-1 justify-center">
                    <DashboardSearch />
                </div>

                {auth && (
                    <span className="flex items-center gap-6 text-xl text-gray-600">
                        <UserAvatar name={auth.user.name} picture={auth.user.picture} />
                    </span>
                )}
            </header>

            <div className="flex flex-1">
                {/* Menu. The ☰ button opens and closes it at every screen size. */}
                <nav id="dashboard-menu" className={`${menuOpen ? "flex w-28 md:w-56" : "hidden md:flex md:w-16"} shrink-0 flex-col gap-2 border-r border-gray-200 p-2`}>
                        <NavLink to="/dashboard" end onClick={() => setMenuOpen(false)} className={linkClass}>
                            <span className="text-xl md:text-lg" aria-hidden="true">🏠︎</span>
                            <span className={labelClass}>Home</span>
                        </NavLink>
                        <NavLink to="/dashboard/activities" onClick={() => setMenuOpen(false)} className={linkClass}>
                            <span className="text-xl md:text-lg" aria-hidden="true">✎</span>
                            <span className={labelClass}>Activities</span>
                        </NavLink>
                        <NavLink to="/dashboard/notes" onClick={() => setMenuOpen(false)} className={linkClass}>
                            <span className="text-xl md:text-lg" aria-hidden="true">🖿</span>
                            <span className={labelClass}>Notes</span>
                        </NavLink>
                        <NavLink to="/dashboard/settings" onClick={() => setMenuOpen(false)} className={linkClass}>
                            <span className="text-3xl md:text-2xl" aria-hidden="true">⚙︎</span>
                            <span className={labelClass}>Settings</span>
                        </NavLink>
                        <button
                            type="button"
                            className={`${itemClass} cursor-pointer`}
                            onClick={logout}
                        >
                            <span className="text-xl md:text-lg" aria-hidden="true">➜]</span>
                            <span className={labelClass}>Logout</span>
                        </button>
                    </nav>

                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
