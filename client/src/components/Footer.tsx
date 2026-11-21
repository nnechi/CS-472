import { Link } from 'react-router-dom'
import wideLogo from "../assets/LittlePointers Logo/Full Logo Wide.png"

interface FooterProps {
    className?: string
}

// Footer: logo on the left, two columns of links on the right, a copyright line below.
export default function Footer({ className }: FooterProps) {
    const linkClass = "py-0.5 hover:underline"

    return(
        <footer className={`mt-auto shrink-0 border-t border-brand bg-brand-light text-brand ${className}`}>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-6 pb-8 pt-12 sm:px-12">

                {/* Row 1: logo (left) and links (right) */}
                <div className="flex flex-wrap items-center justify-between gap-7">
                    <Link to="/" aria-label="LittlePointers home" className="flex items-center gap-3 text-xl font-bold">
                        <img src={wideLogo} alt="" className="h-20 w-auto" />
                    </Link>
                    <div className="flex flex-wrap gap-12">
                        <div className="flex flex-col">
                            <span className="mb-2.5 text-sm font-bold uppercase tracking-widest">Product</span>
                            <Link to="/#features" className={linkClass}>Features</Link>
                            <Link to="/#how" className={linkClass}>How it works</Link>
                            <Link to="/joinroom" className={linkClass}>Join a Room</Link>
                        </div>
                        <div className="flex flex-col">
                            <span className="mb-2.5 text-sm font-bold uppercase tracking-widest">Team</span>
                            <Link to="/#about" className={linkClass}>About Us</Link>
                            <Link to="/login" className={linkClass}>Sign In</Link>
                        </div>
                    </div>
                </div>

                {/* Row 2: copyright, under everything */}
                <p className="border-t border-brand/25 pt-4 text-sm text-brand/70">
                    © {new Date().getFullYear()} LittlePointers · CS 472 project
                </p>
            </div>
        </footer>
    )
}