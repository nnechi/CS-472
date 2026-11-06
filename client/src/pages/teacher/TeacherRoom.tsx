import { useEffect, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import TeacherParsons from "../../components/activity/TeacherParsons"
import ChatWidget from "../../components/chat/ChatWidget"
import RoomLayout from "../../components/chat/RoomLayout"
import { useRoomSocket } from "../../hooks/useRoomSocket"
import type { RoomView } from "../../hooks/roomView"
import useAuth from "../../hooks/useAuth"
import { GROUP_CHAT_ID, Session } from "../../types"
import { normalizeRoomCode } from "../../utils/roomCode"
import { deleteRoom, SessionEndedError } from "../../api"
import TeacherHeader from "../../components/chat/TeacherHeader"
import CodeEditor from "../../components/activity/CodeEditor"
import { HandQueue } from "../../components/HandQueue"

// /rooms/:roomId -- the teacher's view of a room: the activity, the chat, the
// timer, and the raised-hand queue. Students who land here are sent to their
// own view of the same room.
export default function TeacherRoom() {
    const { auth } = useAuth()
    const { roomId } = useParams()
    const roomCode = normalizeRoomCode(roomId ?? "")

    if (!auth || !roomCode) return <Navigate to="/dashboard" replace />

    return (
        <TeacherRoomScreen
            session={{ username: auth.user.name, role: "teacher", room: roomCode }}
            hostID={auth.user.id}
        />
    )
}

// The socket is opened here, so it only runs once the sign-in check has passed.
function TeacherRoomScreen({ session, hostID }: { session: Session; hostID: string }) {
    const navigate = useNavigate()
    const room = useRoomSocket(session, {
        onJoinError: () => {
            window.alert("This room doesn't exist, has ended, or you aren't signed in as its teacher.")
            navigate("/dashboard")
        },
    })

    async function endRoom() {
        if (!window.confirm("End this room for everyone?")) return

        let success: Boolean = false
        try {
            success = await deleteRoom(session.room, hostID)
        } catch (e) {
            if (e instanceof SessionEndedError) {
                // Signed out: log in again, then open this room to end it. Login returns to the room.
                window.alert("Your sign-in has ended. Log in again, then open this room to end it.")
                navigate("/login", { state: { from: { pathname: `/rooms/${session.room}` } } })
                return
            }
            console.error(e)
        }

        if (!success) {
            window.alert("This room could not be ended. Check your connection and try again.")
            return
        }

        navigate("/dashboard")
    }

    return <TeacherRoomView room={room} session={session} onLeave={endRoom} />
}

interface TeacherRoomViewProps {
    // A live room (useRoomSocket) or a saved one (usePastRoom).
    room: RoomView
    session: Session
    // Live: ends the room. Saved: goes back to the previous activities list.
    onLeave: () => void
    // Saved room: a label for the header, e.g. when it ended.
    statusLabel?: string
}

// The teacher's room screen, shared by live rooms and saved (ended) ones. The
// activity panel shows the class activity, or the work of the student picked in
// the dropdown (or whose private chat is open).
export function TeacherRoomView({ room, session, onLeave, statusLabel }: TeacherRoomViewProps) {
    // The student whose work is on screen, or null for the class activity.
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

    // If the selected student leaves a live room, drop the stale selection.
    useEffect(() => {
        if (room.ended) return
        if (selectedStudentId && !room.roster.some((s) => s.id === selectedStudentId)) {
            setSelectedStudentId(null)
        }
    }, [room.ended, room.roster, selectedStudentId])

    // Opening a student's private chat (hand queue or chat tab) shows their work too.
    const openPrivateChat = (studentId: string) => {
        setSelectedStudentId(studentId)
        room.openPrivateChat(studentId)
    }
    const selectChat = (chatId: string) => {
        if (chatId !== GROUP_CHAT_ID) setSelectedStudentId(chatId)
        room.selectChat(chatId)
    }
    const chatRoom: RoomView = { ...room, selectChat, openPrivateChat }

    const selectedStudent = selectedStudentId
        ? room.roster.find((s) => s.id === selectedStudentId) ??
          room.privateChats
              .filter((c) => c.id === selectedStudentId)
              .map((c) => ({ id: c.id, username: c.studentName }))[0]
        : undefined
    const studentId = selectedStudent ? selectedStudent.id : null
    const progress = studentId ? room.studentProgress(studentId) : null
    const parsonsProgress = progress?.type === "parsons" ? progress : undefined
    const codingProgress = progress?.type === "coding" ? progress : null

    return (
        <div className="flex h-screen flex-col bg-white text-black">
            <TeacherHeader
                session={session}
                room={room}
                progress={parsonsProgress}
                selectedStudentId={studentId}
                onSelectStudent={setSelectedStudentId}
                onLeave={onLeave}
                statusLabel={statusLabel}
            />
            {!room.ended && (
                <div className="px-4 py-3 sm:px-8">
                    <HandQueue
                        queue={room.handQueue}
                        onLowerHand={room.lowerHand}
                        onOpenPrivateChat={openPrivateChat}
                    />
                </div>
            )}
            {selectedStudent && (
                <div
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/15 bg-brand-light/40 px-4 py-2 text-sm text-brand sm:px-8"
                >
                    <span className="font-semibold">
                        Viewing {selectedStudent.username}'s work
                        {!progress && <span className="font-normal text-brand/70"> (no work yet)</span>}
                    </span>
                    <button
                        type="button"
                        className="cursor-pointer rounded-full border border-brand/40 bg-white px-3 py-1 font-semibold text-brand shadow-sm hover:bg-brand/10"
                        onClick={() => setSelectedStudentId(null)}
                    >
                        Back to class activity
                    </button>
                </div>
            )}
            <RoomLayout
                activity={room.activity?.type === "parsons" ?
                    (
                        <TeacherParsons
                            title={selectedStudent ? `${selectedStudent.username}'s work` : "Class activity"}
                            activity={room.activity}
                            currentQuestion={room.currentQuestion}
                            progress={selectedStudent ? parsonsProgress ?? { answers: [], results: [], marks: [] } : undefined}
                        />
                    ) :
                    (
                        <CodeEditor
                            activity={room.activity}
                            currentQuestion={room.currentQuestion}
                            role="teacher"
                            {...(selectedStudent
                                // A student's work can't be edited or run: it shows
                                // their code and the output of their last run.
                                ? {
                                      codes: codingProgress?.codes ?? [],
                                      outputs: codingProgress?.outputs ?? [],
                                      emptyMessage: codingProgress
                                          ? "This student hasn't run this code yet."
                                          : "This student hasn't written any code yet.",
                                  }
                                : room.ended
                                // A saved (ended) room's class activity is read-only too.
                                ? { emptyMessage: "No output." }
                                // The live teacher's own playground stays editable and runnable.
                                : {
                                      codes: room.code,
                                      outputs: room.codeOutputs,
                                      run: room.run,
                                      onCodeChange: room.setCode,
                                      onRun: room.runCode,
                                      onCancel: room.cancelRun,
                                  })}
                        />
                    )
                }
                chat={
                    <ChatWidget
                        room={chatRoom}
                        username={session.username}
                        privateLabel={(chat) => `Private: ${chat.studentName}`}
                    />
                }
            />
        </div>
    )
}
