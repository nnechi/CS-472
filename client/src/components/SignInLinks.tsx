import { Link } from 'react-router-dom'

export default function getSignInLinks() {
        return (
            <>
                <Link
                    to="/login"
                    className="text-brand/70 hover:text-brand transition-colors md:rounded-lg md:border md:border-brand md:bg-white md:px-4 md:py-2 md:text-sm md:font-medium md:text-brand md:hover:bg-white/70"
                >
                    Sign In
                </Link>

                <Link
                    to="/signup"
                    className="text-brand/70 hover:text-brand transition-colors md:rounded-lg md:bg-brand md:px-4 md:py-2 md:text-sm md:font-medium md:text-white md:hover:bg-brand/90"
                >
                    Sign Up
                </Link>
            </>
        );
    }