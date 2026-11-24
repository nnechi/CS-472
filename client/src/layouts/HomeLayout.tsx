import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Navbar from '../components/Navbar'
import Footer from "../components/Footer"
import NavLinks from "../components/NavLinks"
import SignInLinks from "../components/SignInLinks"
import useNavbarResize from "../hooks/useNavbarResize"

export default function HomeLayout() {
    const [menuOpen, setMenuOpen] = useState(false)
    const closeMenu = () => setMenuOpen(false)
    useNavbarResize(closeMenu)

    // Start every new page at the top. Without this, a page opened from a
    // scrolled-down page (e.g. Join a Room from the footer) opens scrolled down.
    // Links with a #section (like /#features) are left alone; Home scrolls to those.
    const { pathname, hash } = useLocation()
    useEffect(() => {
        if (hash) return
        window.scrollTo({ top: 0, behavior: "instant" })
    }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    return(
        // overflow-x-clip: the home page's colored bands reach the screen edges
        // without adding a sideways scroll. (clip, not hidden, so sticky still works)
        <div className="min-h-screen flex flex-col overflow-x-clip bg-paper text-brand">

            {/* sticky: the navbar and the small-screen menu stay at the top of the
                screen while the page scrolls. z-30 keeps them above the page. */}
            <div className="sticky top-0 z-30">
                <Navbar
                    className="min-h-[8vh] flex-shrink-0"
                    menuOpen={menuOpen}
                    onToggleMenu={() => setMenuOpen((open) => !open)}
                    onCloseMenu={closeMenu}
                />

                {/* Small screens only. Desktop shows the links in the navbar instead. */}
                {/* Moved here, and top-full, so it opens right under the navbar even after scrolling. */}
                {menuOpen &&
                    <aside className="absolute right-0 top-full z-20 flex w-max flex-col gap-3 border-l border-b border-brand bg-brand-light p-6 shadow-[-2px_0_8px_rgba(34,21,116,0.18)] md:hidden">
                        <NavLinks menuItem onLinkClick={closeMenu} />
                        <SignInLinks menuItem />
                    </aside>
                }
            </div>

            <div className="relative flex flex-1">
                <div className="flex min-w-0 flex-1 flex-col">
                    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-12">
                        <Outlet />
                    </main>
                    <Footer className="min-h-[8vh] flex-shrink-0"/>
                </div>
            </div>
        </div>
    )
}