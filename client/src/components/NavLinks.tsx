import { NavLink } from 'react-router-dom'

interface NavLinksProp {
    onLinkClick?: () => void;
}

export default function NavLinks({ onLinkClick }: NavLinksProp) {
    const getLinkClass = ({isActive}:{isActive:boolean}) => 
        isActive 
            ? "font-bold text-[#161616]" 
            : "text-gray-500 hover:font-bold hover:text-[#161616]";
   
    return (
        <>
            <NavLink to="/about" className={getLinkClass} onClick={onLinkClick}>
                About Us
            </NavLink>
            <NavLink to="/learn-more" className={getLinkClass} onClick={onLinkClick}>
                Learn More
            </NavLink>
            <NavLink to="/contact" className={getLinkClass} onClick={onLinkClick}>
                Contact Us
            </NavLink>
        </>
    );
}