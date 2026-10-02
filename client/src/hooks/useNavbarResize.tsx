import { useEffect } from 'react'

export default function useNavBarResize(closeDropdown : () => void) {
    useEffect(() => {
        const handleResize = () => {
            if(window.innerWidth > 768) 
                closeDropdown()
        }

        window.addEventListener("resize", handleResize)
        return() => {window.removeEventListener("resize", handleResize)}
    }, [closeDropdown])
}