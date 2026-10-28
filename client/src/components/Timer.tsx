import { useState, useEffect } from "react"

// Matches the server's default: every room starts with 15 minutes.
export const DEFAULT_TIMER_MS = 15 * 60 * 1000

interface TimerProps {
  // Full length the teacher chose, and time left, as last sent by the server.
  durationMs: number
  remainingMs: number
  running: boolean
  // Only the teacher gets the controls. Students just watch.
  isTeacher: boolean
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  onSetMinutes: (minutes: number) => void
}

// Teachers can pick whole minutes from 1 to 60.
const MIN_MINUTES = 1
const MAX_MINUTES = 60

const buttonClass =
  "rounded-lg border border-indigo-600 px-3 py-1.5 text-sm text-indigo-600 cursor-pointer hover:bg-indigo-50"

// Shows mm:ss. Rounds up so 15:00 shows until the first second has passed.
function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export default function Timer({
  durationMs,
  remainingMs,
  running,
  isTeacher,
  onPlay,
  onPause,
  onRestart,
  onSetMinutes,
}: TimerProps) {
  const [remaining, setRemaining] = useState(remainingMs)
  // What the teacher is typing. Follows the server's length unless they are editing.
  const [minutesInput, setMinutesInput] = useState(String(durationMs / 60000))

  useEffect(() => {
    setMinutesInput(String(durationMs / 60000))
  }, [durationMs])

  const typedMinutes = Number(minutesInput)
  const validMinutes =
    Number.isInteger(typedMinutes) && typedMinutes >= MIN_MINUTES && typedMinutes <= MAX_MINUTES

  // The server only sends updates on play/pause, so count down here in between.
  // Using the time left (not server clock times) keeps this right even if the
  // teacher's and student's clocks disagree.
  useEffect(() => {
    setRemaining(remainingMs)
    if (!running) return

    const endsAt = Date.now() + remainingMs
    const id = setInterval(() => {
      const left = Math.max(0, endsAt - Date.now())
      setRemaining(left)
      if (left === 0) clearInterval(id)
    }, 250)

    return () => clearInterval(id)
  }, [remainingMs, running])

  const status = running ? "Running" : remaining === 0 ? "Time's up" : "Paused"

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2 text-sm">
      <span className="flex items-baseline gap-2">
        <span className="font-semibold">Timer</span>
        <span className="font-mono text-2xl font-bold tabular-nums" aria-live="off">
          {formatTime(remaining)}
        </span>
        <span className="text-gray-500">{status}</span>
      </span>

      {isTeacher && (
        <span className="flex flex-wrap items-center gap-2">
          {/* Length can only change while paused, so pause first. */}
          <label className="flex items-center gap-1 text-gray-500">
            Minutes
            <input
              type="number"
              min={MIN_MINUTES}
              max={MAX_MINUTES}
              step={1}
              className="w-16 rounded-md border border-gray-300 px-2 py-1 text-black focus:border-indigo-600 focus:outline-none disabled:bg-gray-100"
              value={minutesInput}
              disabled={running}
              onChange={(e) => setMinutesInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={running || !validMinutes}
            className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => onSetMinutes(typedMinutes)}
          >
            Set
          </button>
          <button
            type="button"
            className={
              running
                ? `${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700`
                : buttonClass
            }
            onClick={running ? onPause : onPlay}
          >
            {running ? "Pause" : "Play"}
          </button>
          <button type="button" className={buttonClass} onClick={onRestart}>
            Restart
          </button>
        </span>
      )}
    </div>
  )
}
