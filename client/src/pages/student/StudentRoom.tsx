import { useState } from "react"
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import ActivityBox from "../../components/chat/ActivityBox"
import ChatPanel from "../../components/chat/ChatPanel"
import RoomLayout from "../../components/chat/RoomLayout"
import { RaiseHandButton } from "../../components/HandQueue"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import { socket } from "../../socket"
import { CodeSubmissionLanguage, Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"

// /rooms/join/:roomCode -- the student's view of a room: the activity, the chat,
// and the raise-hand button. Students have no account; the name comes from the
// home page form via router state. Without a name (e.g. a shared link), send
// them back to the home page to enter one.
export default function StudentRoom() {
    const location = useLocation()
    const { roomCode } = useParams()
    const room = normalizeRoomCode(roomCode ?? "")
    const username = (location.state as { username?: string } | null)?.username?.trim()

    if (!room || !username) return <Navigate to="/" replace />

    return <StudentRoomScreen session={{ username, role: "student", room }} />
}

// The socket is opened here, so it only runs once the name check has passed.
function StudentRoomScreen({ session }: { session: Session }) {
    const navigate = useNavigate()
    const room = useRoomSocket(session, {
        onRoomClosed: () => {
            window.alert("Your teacher ended this room.")
            navigate("/")
        },
        onJoinError: () => {
            window.alert("This room doesn't exist or it's expired.")
            navigate("/")
        },
    })

    return (
        <RoomLayout
            session={session}
            // Leaving unmounts the chat, which disconnects the socket and
            // drops the student from the teacher's hand queue.
            onLeave={() => navigate("/")}
            controls={<RaiseHandButton raised={room.handRaised} onToggle={room.raiseHand} />}
            activity={
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <ActivityBox title="Your activity" text={room.studentText} onChange={room.setStudentText} />
                    <CodeSubmissionPanel />
                </div>
            }
            chat={
                <ChatPanel
                    room={room}
                    username={session.username}
                    privateLabel={(chat) => `Private: ${chat.teacherName}`}
                />
            }
        />
    )
}

function CodeSubmissionPanel() {
    const [language, setLanguage] = useState<CodeSubmissionLanguage>("javascript")
    const [code, setCode] = useState("")
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState("Output is not displayed yet.")

    function submitCode() {
        if (!code.trim() || sending) return
        setSending(true)
        setStatus("Running code on the server...")

        socket.timeout(20000).emit("code:submit", { language, code }, (error, receipt) => {
            setSending(false)
            if (error) {
                setStatus("The server did not respond before the run timed out. Try again.")
            } else if (!receipt.accepted) {
                setStatus(receipt.message)
            } else if (receipt.timedOut) {
                setStatus("The server stopped the run after its time limit.")
            } else if (receipt.outputLimitExceeded) {
                setStatus("The server stopped the run after its output limit.")
            } else if (receipt.cancelled) {
                setStatus("The run was cancelled.")
            } else if (receipt.exitCode === null) {
                setStatus("The server could not start the program.")
            } else {
                setStatus(`Server finished the ${receipt.language} submission (${receipt.bytes} bytes, exit code ${receipt.exitCode}). Output is not displayed yet.`)
            }
        })
    }

    return (
        <section className="shrink-0 border-t border-gray-200 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="student-code" className="text-sm font-semibold">Your code</label>
                <select
                    aria-label="Code language"
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as CodeSubmissionLanguage)}
                >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                </select>
            </div>
            <textarea
                id="student-code"
                className="h-40 w-full resize-y rounded-lg border border-gray-300 p-3 font-mono text-sm focus:border-indigo-600 focus:outline-none"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Write code here..."
                maxLength={64 * 1024}
                spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!code.trim() || sending}
                    onClick={submitCode}
                >
                    {sending ? "Sending..." : "Run code"}
                </button>
                <p role="status" className="text-sm text-gray-600">{status}</p>
            </div>
        </section>
    )
}
