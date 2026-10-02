
interface FooterProps {
    className?: string
}

export default function Footer({ className }: FooterProps) {
    return(
        <footer className={`bg-white text-[#AAAAAA] flex shrink-0 py-6 justify-center items-center mt-auto font-medium text-[clamp(0.75rem,1.5vw,1.25rem)] ${className}`}>
            © 2026 AppName and all footer stuff/links Goes Here
        </footer>
    )
}