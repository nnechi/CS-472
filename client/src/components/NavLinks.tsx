import { NavLink } from 'react-router-dom'

interface NavLinksProp {
    onLinkClick?: () => void;
}

export default function NavLinks({ onLinkClick }: NavLinksProp) {
    const getLinkClass = ({isActive}:{isActive:boolean}) => 
        isActive 
            ? "font-bold text-brand underline decoration-2 underline-offset-8"
            : "text-brand/70 hover:text-brand";
   
    return (
        <>
            <NavLink to="/about" className={getLinkClass} onClick={onLinkClick}>
                About Us
            </NavLink>
            <NavLink to="/features" className={getLinkClass} onClick={onLinkClick}>
                Features
            </NavLink>
            {/* <NavLink to="/contact" className={getLinkClass} onClick={onLinkClick}>
                Contact Us
            </NavLink> */}
            <NavLink to="/joinroom" className={getLinkClass} onClick={onLinkClick}>
                Join a Room
            </NavLink>
        </>
    );
}