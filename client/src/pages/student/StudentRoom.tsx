import type { ReactNode } from "react"
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom"
import StudentParsons from "../../components/activity/StudentParsons"
import ChatWidget from "../../components/chat/ChatWidget"
import RoomLayout from "../../components/chat/RoomLayout"
import RoomStatusBanner from "../../components/chat/RoomStatusBanner"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import { Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"
import StudentHeader from "../../components/chat/StudentHeader"
import CodeEditor from "../../components/activity/CodeEditor"

// /rooms/join/:roomCode -- the student's view of a room: the activity, the chat,
// and the raise-hand button. Students have no account; the name comes from the
// join form via router state (a refresh keeps it). Without a name (e.g. the
// link opened in a new tab), send them to the join form with the code filled
// in; joining again with the same name gets their work back.
export default function StudentRoom() {
    const location = useLocation()
    const { roomCode } = useParams()
    const room = normalizeRoomCode(roomCode ?? "")
    const state = location.state as { username?: string; waiting?: boolean } | null
    const username = state?.username?.trim()
    const waiting = state?.waiting ?? false

    if (!room) return <Navigate to="/" replace />
    if (!username) return <Navigate to={`/joinroom?code=${encodeURIComponent(room)}`} replace />

    return <StudentRoomScreen session={{ username, role: "student", room }} waiting={waiting} />
}

// "2:45 PM" in the viewer's own clock.
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })

// A centered card for the screens shown instead of the room.
function RoomCard({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen items-center justify-center bg-white px-4">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-brand bg-white p-9 text-center text-brand shadow-[0_4px_14px_rgba(34,21,116,0.15)]">
                {children}
            </div>
        </div>
    )
}

// The socket is opened here, so it only runs once the name check has passed.
function StudentRoomScreen({ session, waiting }: { session: Session; waiting: boolean }) {
    const navigate = useNavigate()
    const room = useRoomSocket(session, {
        startWaiting: waiting,
        onRoomClosed: (reason) => {
            window.alert(
                reason === "teacher-away"
                    ? "Your teacher didn't come back, so this room has closed. Your work was saved for them."
                    : reason === "expired"
                      ? "This room has closed. Your work was saved for your teacher."
                      : "Your teacher ended this room."
            )
            navigate("/")
        },
        onJoinError: (reason) => {
            window.alert(
                reason === "ended"
                    ? "This room has ended. Any work you did was saved for your teacher."
                    : "This room isn't available. Your teacher may not have opened it, or it has ended."
            )
            navigate("/")
        },
    })

    // Leave gives up the seat, so ask first: joining again starts over.
    async function leave() {
        if (!window.confirm("Leave this room? Your teacher keeps the work you've done, but if you join again you'll start over.")) return
        await room.leave()
        navigate("/")
    }

    // Another tab (or window) opened this room with the same name and has the
    // seat now. Taking it back brings the work done there to this tab.
    if (room.replaced) {
        return (
            <RoomCard>
                <h1 className="text-2xl font-bold">This room is open in another tab</h1>
                <p className="text-brand/70">
                    You can only be in a room in one place at a time. Your work moves with you.
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                    <button
                        type="button"
                        className="rounded-lg bg-brand px-4 py-2 text-white cursor-pointer hover:opacity-90"
                        onClick={room.reclaim}
                    >
                        Use this tab
                    </button>
                    <button
                        type="button"
                        className="rounded-lg border border-brand/30 px-4 py-2 text-brand cursor-pointer hover:bg-brand-light"
                        onClick={() => navigate("/")}
                    >
                        Close
                    </button>
                </div>
            </RoomCard>
        )
    }

    // Joined before the teacher opened the room: hold here until "room opened".
    if (room.waiting) {
        return (
            <RoomCard>
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
            </RoomCard>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-white text-black">
            {/* Leaving unmounts the chat, which disconnects the socket and
                drops the student from the teacher's hand queue. The student
                room has no site-wide navbar — this header is the top of the page. */}
            <StudentHeader session={session} room={room} onLeave={leave} />

            {room.reconnecting && (
                <RoomStatusBanner kind="offline">
                    Connection lost. Reconnecting… Keep working: your work stays on this page and is saved once you're back.
                </RoomStatusBanner>
            )}
            {!room.reconnecting && room.teacherAway && (
                <RoomStatusBanner kind="away">
                    Your teacher stepped away. The room is still open, so keep working.
                    {room.roomClosesAt &&
                        ` If they aren't back by ${clockTime(room.roomClosesAt)}, the room will close and your work will be saved for them.`}
                </RoomStatusBanner>
            )}

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
                            editError={room.codeEditError?.(null, room.currentQuestion)}
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
