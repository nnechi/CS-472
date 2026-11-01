import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import useNavbarResize from "../hooks/useNavbarResize"
import NavLinks from "./NavLinks"
import SignInLinks from "./SignInLinks"
import fullLogo from "../assets/LittlePointers Logo/full Logo.png"

interface NavbarProps {
    className?: string
}

export default function Navbar( {className}: NavbarProps) {
    const [dropdown, setDropdown] = useState(false)
    useNavbarResize(() => setDropdown(false))

    function getLogo() {
        return (
            <NavLink to="/" aria-label="LittlePointers home">
                <img src={fullLogo} alt="" className="h-14 w-14 rounded-full object-cover"/>
            </NavLink>
        )
    }

    return(
        <nav className={`relative w-full border-b border-brand bg-brand-light text-brand ${className}`}>
            
            <div className="mx-auto flex h-16 w-full items-center justify-between px-5 flex-nowrap sm:h-20 sm:px-8">
                
                {/* LEFT GROUP: Logo and Main Nav Links */}
                <div className="flex flex-nowrap items-center gap-12 whitespace-nowrap">
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
                    className="rounded-lg p-2 text-[clamp(1.2rem,2vw,1.5rem)] text-brand cursor-pointer hover:bg-white/60 md:hidden"
                    onClick={() => setDropdown(!dropdown)}
                    aria-label="Toggle dropdown menu"
                >
                    ☰
                </button>

                {/* Mobile Dropdown Menu */}
                {dropdown && 
                    <div className="absolute top-full right-0 flex flex-col gap-3 w-max rounded-bl-lg border-b border-l border-brand bg-brand-light p-6 shadow-md md:hidden">
                        <NavLinks onLinkClick={() => setDropdown(false)} />
                        <SignInLinks />
                    </div>
                }
            
            </div>
        </nav>
    )     
}