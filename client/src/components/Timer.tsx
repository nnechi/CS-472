import { FormEvent, useEffect, useId, useState } from "react"
import { Play, Pause, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

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
  // The "change length" popover, opened from the time display itself.
  const [setOpen, setSetOpen] = useState(false)
  const minutesFieldId = useId()
  const minutesErrorId = useId()
  const triggerDescriptionId = useId()

  useEffect(() => {
    setMinutesInput(String(durationMs / 60000))
  }, [durationMs])

  // Changing the length only makes sense while paused. If the timer starts
  // running while the popover happens to be open, close it rather than leave
  // a now-invalid form on screen.
  useEffect(() => {
    if (running) setSetOpen(false)
  }, [running])

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

  const expired = !running && remaining === 0
  // Only changes at an actual state transition (running starts/stops, or hits
  // zero) rather than every tick, so a screen reader announces it once instead
  // of flooding the user every second.
  const status = running ? "Timer running" : expired ? "Time's up" : "Timer paused"

  const playPauseLabel = running
    ? "Pause timer"
    : expired
      ? "Restart and start timer"
      : remaining === durationMs
        ? "Start timer"
        : "Resume timer"

  function handleSetMinutes(e: FormEvent) {
    e.preventDefault()
    if (!validMinutes) return
    onSetMinutes(typedMinutes)
    setSetOpen(false)
  }

  return (
    <div className="flex items-center justify-center">
      <div
        role="group"
        aria-label="Activity timer"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border bg-white px-2.5 py-2 shadow-sm transition-colors sm:gap-3 sm:px-3",
          running && "border-pop/70 ring-1 ring-pop/30",
          expired && "border-warn ring-1 ring-warn/60",
          !running && !expired && "border-brand/15"
        )}
      >
        {isTeacher && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    aria-label={playPauseLabel}
                    className="size-11 shrink-0 rounded-full bg-brand text-white shadow-sm hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    onClick={running ? onPause : onPlay}
                  >
                    {running ? <Pause /> : <Play />}
                  </Button>
                }
              />
              <TooltipContent>{running ? "Pause" : "Play"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {isTeacher ? (
          <Popover open={setOpen} onOpenChange={setSetOpen}>
            <span id={triggerDescriptionId} className="sr-only">
              {running
                ? "Pause the timer to change its length."
                : `Opens a popover to set the timer's length, from ${MIN_MINUTES} to ${MAX_MINUTES} minutes.`}
            </span>
            <PopoverTrigger
              disabled={running}
              aria-describedby={triggerDescriptionId}
              aria-live="off"
              className="rounded-md px-1.5 font-mono text-2xl font-bold tabular-nums text-brand outline-none transition-colors hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-default disabled:hover:bg-transparent sm:text-3xl"
            >
              {formatTime(remaining)}
            </PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>Timer length</PopoverTitle>
              <PopoverDescription className="mt-1">
                Only while the timer is paused.
              </PopoverDescription>
              <form onSubmit={handleSetMinutes} className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={minutesFieldId} className="text-sm font-medium text-brand">
                    Minutes
                  </label>
                  <input
                    id={minutesFieldId}
                    type="number"
                    inputMode="numeric"
                    min={MIN_MINUTES}
                    max={MAX_MINUTES}
                    step={1}
                    value={minutesInput}
                    onChange={(e) => setMinutesInput(e.target.value)}
                    aria-invalid={!validMinutes}
                    aria-describedby={!validMinutes ? minutesErrorId : undefined}
                    className="w-full rounded-md border border-brand/30 bg-white px-3 py-2 text-brand focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                  {!validMinutes && (
                    <p id={minutesErrorId} role="alert" className="text-sm text-red-600">
                      Enter a whole number between {MIN_MINUTES} and {MAX_MINUTES}.
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!validMinutes}
                  className="w-full bg-brand text-white hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Set
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        ) : (
          <span
            aria-live="off"
            className="rounded-md px-1.5 font-mono text-2xl font-bold tabular-nums text-brand sm:text-3xl"
          >
            {formatTime(remaining)}
          </span>
        )}

        {isTeacher && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    aria-label="Restart timer"
                    className="size-11 shrink-0 rounded-full bg-brand text-white shadow-sm hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    onClick={onRestart}
                  >
                    <RotateCcw />
                  </Button>
                }
              />
              <TooltipContent>Restart</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <span aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  )
}
