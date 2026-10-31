import { useState } from "react"
import { Link, NavLink, Outlet } from "react-router-dom"
import useAuth from "../hooks/useAuth"
import DashboardSearch from "../components/DashboardSearch"
import UserAvatar from "../components/UserAvatar"
import shortLogo from "../assets/LittlePointers Logo/Short Logo.png"

// Menu items stack the icon above the text on small screens and sit side by side on laptop and larger.
const menuItemBase = "group relative flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-sm text-brand hover:bg-white/60 md:flex-row md:gap-3 md:px-3 md:text-left md:text-lg"

// Shows the item's name beside its icon while the menu is closed. The labels are hidden then, so the
// tooltip is the only text. An open menu already shows the labels, so it never shows the tooltip.
const tooltipClass = (menuOpen: boolean) => menuOpen
    ? "hidden"
    : "pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-brand px-2 py-1 text-sm text-white group-hover:block"

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
        `${itemClass} ${isActive ? "bg-white font-semibold" : ""}`
    const labelClass = menuOpen ? "" : "md:hidden"

    return(
        <div className="min-h-screen flex flex-col bg-paper text-brand">
            {/* The header has no left padding at any size, so the ☰ button and logo stay in the same place. The button lines up with the closed menu's edge. */}
            <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-brand bg-brand-light py-3 pr-4 sm:h-20 sm:py-0 sm:pr-8">
                <div className="flex h-14 items-center gap-0">
                    <button
                        type="button"
                        className="flex h-14 w-16 items-center justify-center rounded-lg px-0 text-4xl leading-none text-brand cursor-pointer hover:bg-white/60"
                        onClick={() => setMenuOpen((open) => !open)}
                        title="Menu"
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        aria-controls="dashboard-menu"
                    >
                        ☰
                    </button>

                    {/* Short logo at every screen size. It goes back to the dashboard. */}
                    <Link to="/dashboard" aria-label="LittlePointers dashboard">
                        <img src={shortLogo} alt="" className="h-10" />
                    </Link>
                </div>

                {/* Below 640px the search takes a full row under the menu, logo and profile picture, so the placeholder is not cut off. */}
                <div className="order-last flex w-full justify-center pb-3 pl-4 pr-4 sm:order-none sm:w-auto sm:flex-1 sm:p-0">
                    <DashboardSearch />
                </div>

                {auth && (
                    <span className="flex items-center gap-6 text-xl text-brand">
                        {/* The profile picture goes to the settings page. */}
                        <Link to="/dashboard/settings" aria-label="Go to settings" className="rounded-full">
                            <UserAvatar name={auth.user.name} picture={auth.user.picture} />
                        </Link>
                    </span>
                )}
            </header>

            <div className="flex flex-1">
                {/* Menu. The ☰ button opens and closes it at every screen size. */}
                <nav id="dashboard-menu" className={`${menuOpen ? "flex w-28 md:w-56" : "hidden md:flex md:w-16"} relative z-10 shrink-0 flex-col gap-2 border-r border-brand bg-brand-light p-2 shadow-[2px_0_8px_rgba(34,21,116,0.18)]`}>
                        <NavLink to="/dashboard" end aria-label="Home" onClick={() => setMenuOpen(false)} className={linkClass}>
                            <span className="text-xl md:text-lg" aria-hidden="true">🏠︎</span>
                            <span className={labelClass}>Home</span>
                            <span className={tooltipClass(menuOpen)} aria-hidden="true">Home</span>
                        </NavLink>
                        <NavLink to="/dashboard/activities" aria-label="Activities" onClick={() => setMenuOpen(false)} className={linkClass}>
                            <span className="text-xl md:text-lg" aria-hidden="true">✎</span>
                            <span className={labelClass}>Activities</span>
                            <span className={tooltipClass(menuOpen)} aria-hidden="true">Activities</span>
                        </NavLink>
                        <NavLink to="/dashboard/notes" aria-label="Notes" onClick={() => setMenuOpen(false)} className={linkClass}>
                            <span className="text-xl md:text-lg" aria-hidden="true">🖿</span>
                            <span className={labelClass}>Notes</span>
                            <span className={tooltipClass(menuOpen)} aria-hidden="true">Notes</span>
                        </NavLink>
                        <NavLink to="/dashboard/settings" aria-label="Settings" onClick={() => setMenuOpen(false)} className={linkClass}>
                            <span className="text-3xl md:text-2xl" aria-hidden="true">⛭</span>
                            <span className={labelClass}>Settings</span>
                            <span className={tooltipClass(menuOpen)} aria-hidden="true">Settings</span>
                        </NavLink>
                        <button
                            type="button"
                            className={`${itemClass} cursor-pointer`}
                            aria-label="Logout"
                            onClick={logout}
                        >
                            <span className="text-xl md:text-lg" aria-hidden="true">➜]</span>
                            <span className={labelClass}>Logout</span>
                            <span className={tooltipClass(menuOpen)} aria-hidden="true">Logout</span>
                        </button>
                    </nav>

                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
