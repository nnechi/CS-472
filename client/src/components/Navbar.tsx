import { NavLink } from 'react-router-dom'
import NavLinks from "./NavLinks"
import SignInLinks from "./SignInLinks"
import shortLogo from "../assets/LittlePointers Logo/Short Logo.png"

interface NavbarProps {
    className?: string
    menuOpen: boolean
    onToggleMenu: () => void
    onCloseMenu: () => void
}

// The menu itself is rendered by the layout beside the page, so it pushes the content over.
export default function Navbar( {className, menuOpen, onToggleMenu, onCloseMenu}: NavbarProps) {

    function getLogo() {
        return (
            <NavLink to="/" aria-label="LittlePointers home" onClick={onCloseMenu}>
                <img src={shortLogo} alt="" className="h-10"/>
            </NavLink>
        )
    }

    return(
        <nav className={`relative w-full border-b border-brand bg-brand-light text-brand ${className}`}>
            
            <div className="mx-auto flex h-16 w-full items-center justify-between px-5 flex-nowrap sm:h-20 sm:px-8">
                
                {/* LEFT GROUP: Logo and Main Nav Links */}
                <div className="flex flex-nowrap items-center gap-8 whitespace-nowrap">
                    {getLogo()}
                    <div className="hidden items-center gap-6 md:flex">
                        <NavLinks />
                    </div>
                </div>

                {/* RIGHT GROUP: Sign In Links */}
                <div className="hidden items-center gap-6 md:flex">
                    <SignInLinks />
                </div>

                {/* Only shows when desktop elements hide */}
                <button 
                    className="flex h-14 w-16 items-center justify-center rounded-lg px-0 text-4xl leading-none text-brand cursor-pointer hover:bg-white/60 md:hidden"
                    onClick={onToggleMenu}
                    title="Menu"
                    aria-label="Toggle dropdown menu"
                    aria-expanded={menuOpen}
                >
                    ☰
                </button>
            
            </div>
        </nav>
    )     
}