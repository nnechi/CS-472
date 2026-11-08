import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import StudentParsons from "../../components/activity/StudentParsons"
import ChatWidget from "../../components/chat/ChatWidget"
import RoomLayout from "../../components/chat/RoomLayout"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import { Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"
import StudentHeader from "../../components/chat/StudentHeader"
import CodeEditor from "../../components/activity/CodeEditor"

// /rooms/join/:roomCode -- the student's view of a room: the activity, the chat,
// and the raise-hand button. Students have no account; the name comes from the
// home page form via router state. Without a name (e.g. a shared link), send
// them back to the home page to enter one.
export default function StudentRoom() {
    const location = useLocation()
    const { roomCode } = useParams()
    const room = normalizeRoomCode(roomCode ?? "")
    const state = location.state as { username?: string; waiting?: boolean } | null
    const username = state?.username?.trim()
    const waiting = state?.waiting ?? false

    if (!room || !username) return <Navigate to="/" replace />

    return <StudentRoomScreen session={{ username, role: "student", room }} waiting={waiting} />
}

// The socket is opened here, so it only runs once the name check has passed.
function StudentRoomScreen({ session, waiting }: { session: Session; waiting: boolean }) {
    const navigate = useNavigate()
    const room = useRoomSocket(session, {
        startWaiting: waiting,
        onRoomClosed: () => {
            window.alert("Your teacher ended this room.")
            navigate("/")
        },
        onJoinError: () => {
            window.alert("This room isn't available. Your teacher may not have opened it or it has expired.")
            navigate("/")
        },
    })

    // Joined before the teacher opened the room: hold here until "room opened".
    if (room.waiting) {
        return (
            <div className="flex h-screen items-center justify-center bg-white px-4">
                <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-brand bg-white p-9 text-center text-brand shadow-[0_4px_14px_rgba(34,21,116,0.15)]">
                    <div
                        className="h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand"
                        aria-hidden="true"
                    />
                    <h1 className="text-2xl font-bold">Waiting for your teacher…</h1>
                    <p className="text-brand/70">You'll join automatically when the room opens.</p>
                    <p className="text-sm text-brand/70">Room code</p>
                    <p className="-mt-3 text-2xl font-bold tracking-widest">{session.room}</p>
                    <button
                        type="button"
                        className="mt-2 rounded-lg border border-brand/30 px-4 py-2 text-brand cursor-pointer hover:bg-brand-light"
                        onClick={() => navigate("/")}
                    >
                        Leave
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen flex-col bg-white text-black">
            {/* Leaving unmounts the chat, which disconnects the socket and
                drops the student from the teacher's hand queue. The student
                room has no site-wide navbar — this header is the top of the page. */}
            <StudentHeader session={session} room={room} onLeave={() => navigate("/")} />

            <RoomLayout
                activity={room.activity?.type === "parsons" ? 
                    (
                        <StudentParsons
                            activity={room.activity}
                            currentQuestion={room.currentQuestion}
                            answers={room.studentAnswers}
                            results={room.studentResults}
                            feedback={room.studentFeedback}
                            onChange={room.setStudentAnswer}
                            onCheck={room.checkAnswer}
                            onReset={room.resetProblem}
                        />
                    ) :
                    (
                        <CodeEditor 
                            activity={room.activity}
                            currentQuestion={room.currentQuestion}
                            role="student"
                            codes={room.code}
                            outputs={room.codeOutputs}
                            run={room.run}
                            onCodeChange={room.setCode}
                            onRun={room.runCode}
                            onCancel={room.cancelRun}
                        />
                    )
                }
                chat={
                    <ChatWidget
                        room={room}
                        username={session.username}
                        privateLabel={(chat) => `Private: ${chat.teacherName}`}
                    />
                }
            />
        </div>
    )
}
