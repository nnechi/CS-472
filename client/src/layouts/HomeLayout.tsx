import { useState } from "react"
import { Outlet } from "react-router-dom"
import Navbar from '../components/Navbar'
import Footer from "../components/Footer"
import NavLinks from "../components/NavLinks"
import SignInLinks from "../components/SignInLinks"
import useNavbarResize from "../hooks/useNavbarResize"

export default function HomeLayout() {
    const [menuOpen, setMenuOpen] = useState(false)
    const closeMenu = () => setMenuOpen(false)
    useNavbarResize(closeMenu)

    return(
        <div className="min-h-screen flex flex-col bg-paper text-brand">
            <Navbar
                className="min-h-[8vh] flex-shrink-0"
                menuOpen={menuOpen}
                onToggleMenu={() => setMenuOpen((open) => !open)}
                onCloseMenu={closeMenu}
            />

            {/* Below the navbar. The menu floats over the page content on the right without moving it. */}
            <div className="relative flex flex-1">
                <div className="flex min-w-0 flex-1 flex-col">
                    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-12">
                        <Outlet />
                    </main>
                    <Footer className="min-h-[8vh] flex-shrink-0"/>
                </div>

                {/* Small screens only. Desktop shows the links in the navbar instead. */}
                {menuOpen &&
                    <aside className="absolute right-0 top-0 z-20 flex w-max flex-col gap-3 border-l border-b border-brand bg-brand-light p-6 shadow-[-2px_0_8px_rgba(34,21,116,0.18)] md:hidden">
                        <NavLinks menuItem onLinkClick={closeMenu} />
                        <SignInLinks menuItem />
                    </aside>
                }
            </div>
        </div>
    )
}
