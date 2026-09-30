import { Link, NavLink } from 'react-router-dom'

export default function Navbar() {

    const activeStyles = {
        fontWeight: "bold",
        textDecoration: "underline",
        color: "#161616"
    }

    return(
        <nav className="navbar">
            <div className="navbar-left">
                <NavLink to="/" className="logo">Logo</NavLink>

                <div className="nav-links">
                    <NavLink
                        to="/about" style={({isActive}) => isActive ? activeStyles : undefined}
                    >
                        About Us
                    </NavLink>
                    <NavLink 
                        to="/learn-more" style={({isActive}) => isActive ? activeStyles : undefined}
                    >
                        Learn More
                    </NavLink>
                    <NavLink 
                        to="/contact" style={({isActive}) => isActive ? activeStyles : undefined}
                    >
                        Contact Us
                    </NavLink>
                </div>
            </div>

            <div className="navbar-right">
                <Link to="/login" className="nav-button signin">Sign In</Link>
                <Link to="/signup" className="nav-button signup">Sign Up</Link>
            </div>

        </nav>
    )
}