import { Link, NavLink } from 'react-router-dom'

interface NavLinksProp {
    onLinkClick?: () => void;
    // True inside the side menu, where links look like the dashboard menu items.
    menuItem?: boolean;
}

// Same look as the teacher dashboard menu items: white when current or hovered.
const menuItemClass = ({isActive}:{isActive:boolean}) =>
    `flex items-center rounded-lg px-3 py-2 text-lg text-brand hover:bg-white/60 ${isActive ? "bg-white font-semibold" : ""}`;

export default function NavLinks({ onLinkClick, menuItem = false }: NavLinksProp) {
    const getLinkClass = ({isActive}:{isActive:boolean}) => 
        // Same white highlight as the dashboard menu: white when current, light gray on hover.
        `rounded-lg px-3 py-2 text-lg md:text-xl text-brand hover:bg-white/60 ${isActive
            ? "bg-white font-semibold"
            : "font-normal"}`;

    // About Us and Features now scroll to their sections on the home page.
    // NavLink ignores the "#..." part, so on the home page it would mark both as
    // current. These use Link with the normal (not current) look instead.
    const sectionLinkClass = menuItem
        ? menuItemClass({ isActive: false })
        : getLinkClass({ isActive: false });
   
    return (
        <>
            {/* NavLink to="/about" became Link to="/#about" */}
            <Link to="/#about" className={sectionLinkClass} onClick={onLinkClick}>
                About Us
            </Link>
            {/* NavLink to="/features" became Link to="/#features" */}
            <Link to="/#features" className={sectionLinkClass} onClick={onLinkClick}>
                Features
            </Link>
            {/* <NavLink to="/contact" className={menuItem ? menuItemClass : getLinkClass} onClick={onLinkClick}>
                Contact Us
            </NavLink> */}
            <NavLink to="/joinroom" className={menuItem ? menuItemClass : getLinkClass} onClick={onLinkClick}>
                Join a Room
            </NavLink>
        </>
    );
}