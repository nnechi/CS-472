import { Link, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function Navbar() {
    const [dropdown, setDropdown] = useState(false)

    const activeStyles = {
        fontWeight: "bold",
        textDecoration: "underline",
        color: "#161616"
    }

    useEffect(() => {
        const handleResize = () => {
            if(window.innerWidth > 770) 
                setDropdown(false)
        }

        window.addEventListener("resize", handleResize)
        return() => {window.removeEventListener("resize", handleResize)}
    }, [])

    function getLogo() {
        return (
            <NavLink to="/" className="logo">Logo</NavLink>
        )
    }

    function getNavLinks(onLinkClick?: () => void) {
        return (
            <>
                <NavLink
                    to="/about" style={({isActive}) => isActive ? activeStyles : undefined} onClick={onLinkClick}
                >
                    About Us
                </NavLink>
                <NavLink 
                    to="/learn-more" style={({isActive}) => isActive ? activeStyles : undefined} onClick={onLinkClick}
                >
                    Learn More
                </NavLink>
                <NavLink 
                    to="/contact" style={({isActive}) => isActive ? activeStyles : undefined} onClick={onLinkClick}
                >
                    Contact Us
                </NavLink>
            </>
        )
    }

    function getSignInLinks() {
        return (
            <>
                <Link to="/login" className={!dropdown ? "nav-button signin" : ""}>Sign In</Link>
                <Link to="/signup" className={!dropdown ? "nav-button signup" : ""}>Sign Up</Link>
            </>
        )
    }

    return(
        <nav>
            <div className="navbar-content">
                <div className="navbar-left">
                    { getLogo() }

                    <div className="nav-links hidden">
                        { getNavLinks() }
                    </div> 
                </div>

                <div className="navbar-right hidden">
                    { getSignInLinks() }
                </div> 

                <button
                    className="menu-button"
                    onClick={() => setDropdown(!dropdown)}
                >
                    ≣
                </button>
            </div>

            {dropdown && (
                <div className="mobile-navbar">
                    { getNavLinks(() => setDropdown(false)) }
                    { getSignInLinks() } 
                </div>
            )} 
        </nav>
    )
}