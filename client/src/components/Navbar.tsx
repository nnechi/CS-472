import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import useNavbarResize from "../hooks/useNavbarResize"
import NavLinks from "./NavLinks"
import SignInLinks from "./SignInLinks"


export default function Navbar() {
    const [dropdown, setDropdown] = useState(false)
    useNavbarResize(() => setDropdown(false))

    function getLogo() {
        return <NavLink to="/">Logo</NavLink>
    }

    return(
        <nav className="relative w-full bg-white text-black">
            
            <div className="mx-auto flex h-20 w-full items-center justify-between px-4 flex-nowrap">
                
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
                    className="text-2xl md:hidden"
                    onClick={() => setDropdown(!dropdown)}
                    aria-label="Toggle dropdown menu"
                >
                    ☰
                </button>

                {/* Mobile Dropdown Menu */}
                {dropdown && 
                    <div className="absolute top-full right-0 flex flex-col w-max bg-white p-6 shadow-md md:hidden">
                        <NavLinks onLinkClick={() => setDropdown(false)} />
                        <SignInLinks />
                    </div>
                }
            
            </div>
        </nav>
    )     
}