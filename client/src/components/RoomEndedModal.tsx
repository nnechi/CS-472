import { useEffect, useRef } from "react"

interface RoomEndedModalProps {
    onOkay: () => void
}

// Shown to a student when their teacher ends the room. Styled to match the
// "Join a Room" card (JoinRoom.tsx): same purple, rounded corners, same
// button style, so it reads as part of the same popup family.
export default function RoomEndedModal({ onOkay }: RoomEndedModalProps) {
    const okayButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        okayButtonRef.current?.focus()
    }, [])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault()
                onOkay()
            } else if (e.key === "Tab") {
                // The Okay button is the only focusable element, so trap focus on it
                // instead of letting Tab reach the ended room underneath.
                e.preventDefault()
                okayButtonRef.current?.focus()
            }
        }
        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [onOkay])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="room-ended-heading"
                className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl bg-[#CDC8F4] px-9 py-10 text-center text-[#1F1666] shadow-[0_4px_14px_rgba(34,21,116,0.15)]"
            >
                <h2 id="room-ended-heading" className="text-2xl font-bold">
                    Your teacher has ended this activity.
                </h2>
                <button
                    ref={okayButtonRef}
                    type="button"
                    onClick={onOkay}
                    className="w-full max-w-xs whitespace-nowrap rounded-lg bg-[#1F1666] px-6 py-4 text-lg text-white cursor-pointer hover:bg-[#2E2390] sm:text-xl"
                >
                    Return to Home Page
                </button>
            </div>
        </div>
    )
}
