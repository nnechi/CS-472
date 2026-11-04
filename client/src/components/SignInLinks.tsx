import { Link } from 'react-router-dom'

// menuItem: true inside the side menu, where the links look like the dashboard menu items.
export default function getSignInLinks({ menuItem = false }: { menuItem?: boolean } = {}) {
        const menuClass = "flex items-center rounded-lg px-3 py-2 text-lg text-brand hover:bg-white/60"
        return (
            <>
                <Link
                    to="/login"
                    className={menuItem ? menuClass : "text-brand/70 hover:text-brand transition-colors md:rounded-lg md:border md:border-brand md:bg-white md:px-4 md:py-2 text-base md:text-lg font-normal md:text-brand md:hover:bg-white/70"}
                >
                    Sign In
                </Link>

                <Link
                    to="/signup"
                    className={menuItem ? menuClass : "text-brand/70 hover:text-brand transition-colors md:rounded-lg md:border md:border-brand md:bg-brand md:px-4 md:py-2 text-base md:text-lg font-normal md:text-white md:hover:bg-white/70 md:hover:text-brand"}
                >
                    Sign Up
                </Link>
            </>
        );
    }