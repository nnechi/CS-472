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

    // The question on screen, as CodeEditor shows it, so its code is saved under the right question.
    const questionCount = room.activity?.questions.length ?? 0
    const questionIndex = Math.max(0, Math.min(room.currentQuestion, questionCount - 1))

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
                            code={room.studentCodes[questionIndex] ?? ""}
                            onCodeChange={(code) => room.setStudentCode(questionIndex, code)}
                            output={room.studentOutputs[questionIndex] ?? null}
                            onOutputChange={(output) => room.setStudentOutput(questionIndex, output)}
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
