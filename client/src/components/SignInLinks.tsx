import { Link } from 'react-router-dom'

export default function getSignInLinks() {
        return (
            <>
                <Link
                    to="/login"
                    className="text-gray-600 hover:font-bold hover:text-[#161616] transition-colors md:rounded-lg md:border md:border-neutral-300 md:px-4 md:py-2 md:text-sm md:font-medium md:hover:bg-neutral-200"
                >
                    Sign In
                </Link>

                <Link
                    to="/signup"
                    className="text-gray-600 hover:font-bold hover:text-[#161616] transition-colors md:rounded-lg md:bg-neutral-100 md:text-neutral-900 md:px-4 md:py-2 md:text-sm md:font-medium md:hover:bg-neutral-200"
                >
                    Sign Up
                </Link>
            </>
        );
    }