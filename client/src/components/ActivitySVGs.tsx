// A note with a dog-eared top corner and lines of text, tilted slightly.
export function NoteIcon({ className = "text-brand" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`h-6 w-6 shrink-0 -rotate-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="14" y2="17" />
        </svg>
    )
}

// A trash can with a lid and a handle.
export function TrashIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M5 6l1 14h12l1-14" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
    )
}

// A play button: a triangle pointing right.
export function PlayIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 4l13 8-13 8z" />
        </svg>
    )
}

// A stop sign: an octagon, used on the Stop button.
export function StopIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" />
        </svg>
    )
}

// A pencil for editing.
export function PencilIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 3l5 5L8 21H3v-5z" />
            <line x1="13.5" y1="5.5" x2="18.5" y2="10.5" />
        </svg>
    )
}
