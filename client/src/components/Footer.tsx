import { Link } from 'react-router-dom'
import wideLogo from "../assets/LittlePointers Logo/Full Logo Wide.png"
import shortLogo from "../assets/LittlePointers Logo/Short Logo.png"

interface FooterProps {
    className?: string
}

export default function Footer({ className }: FooterProps) {
    return(
        <footer className={`border-t border-brand bg-brand-light text-brand/70 flex shrink-0 px-6 py-10 justify-center items-center sm:px-12 mt-auto font-medium text-[clamp(0.875rem,1.7vw,1.375rem)] ${className}`}>
            <div className="flex w-full flex-row items-center justify-start gap-2 md:gap-4">
                <Link to="/" aria-label="LittlePointers home" className="shrink-0">
                    <img src={shortLogo} alt="" className="h-14 w-auto sm:hidden" />
                    <img src={wideLogo} alt="" className="hidden sm:block sm:h-auto sm:w-80" />
                </Link>
                <div className="flex gap-4 text-left sm:gap-8 md:gap-12">
                    <div className="flex flex-col gap-2">
                        <span className="font-bold text-brand">About</span>
                        <Link to="/about" className="hover:text-brand hover:underline">About Us</Link>
                        <Link to="/features" className="hover:text-brand hover:underline">Features</Link>
                    </div>
                    <div className="flex translate-x-6 flex-col gap-2 md:translate-x-12">
                        <span className="font-bold text-brand">Join</span>
                        <Link to="/joinroom" className="hover:text-brand hover:underline">Join a Room</Link>
                        <span>
                            Are you a teacher?{' '}
                            <Link to="/login" className="font-semibold text-brand hover:underline">Sign in</Link>
                            {' '}to create a room.
                        </span>
                    </div>
                </div>
            </div>
        </footer>

    )
}