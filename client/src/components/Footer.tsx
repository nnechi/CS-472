import { Link } from 'react-router-dom'

interface FooterProps {
    className?: string
}

export default function Footer({ className }: FooterProps) {
    return(
        <footer className={`border-t border-brand bg-brand-light text-brand/70 flex shrink-0 py-6 justify-center items-center mt-auto font-medium text-[clamp(0.75rem,1.5vw,1.25rem)] ${className}`}>
            <span>
                © 2026{' '}
                <Link to="/" className="font-semibold text-brand hover:underline">
                    LittlePointers
                </Link>{' '}
                and all footer stuff/links Goes Here
            </span>
        </footer>

    )
}