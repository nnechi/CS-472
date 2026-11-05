import { NavLink } from 'react-router-dom'

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
        `rounded-lg px-3 py-2 text-base md:text-lg text-brand hover:bg-white/60 ${isActive
            ? "bg-white font-semibold"
            : "font-normal"}`;
   
    return (
        <>
            <NavLink to="/about" className={menuItem ? menuItemClass : getLinkClass} onClick={onLinkClick}>
                About Us
            </NavLink>
            <NavLink to="/features" className={menuItem ? menuItemClass : getLinkClass} onClick={onLinkClick}>
                Features
            </NavLink>
            {/* <NavLink to="/contact" className={menuItem ? menuItemClass : getLinkClass} onClick={onLinkClick}>
                Contact Us
            </NavLink> */}
            <NavLink to="/joinroom" className={menuItem ? menuItemClass : getLinkClass} onClick={onLinkClick}>
                Join a Room
            </NavLink>
        </>
    );
}