import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import type { RoomStatSummary } from "../../types"

// Colors use the app's brand tokens (brand purple #221574 on light, brand-light #a6cfd5 on dark)
// so the stats match the rest of the app. Gridlines and muted axis text stay neutral.
// Each is written as a light value with a dark: override.
export const CARD = "rounded-lg border border-brand/20 bg-white p-5 dark:border-white/10 dark:bg-[#1a1a19]"
const TEXT_PRIMARY = "text-brand dark:text-brand-light"
const TEXT_SECONDARY = "text-gray-600 dark:text-[#c3c2b7]"
const TEXT_MUTED = "fill-[#5a52a6]"

// How many weeks the rooms-per-week chart covers, and how many rooms the recent table lists.
const WEEKS = 12
const RECENT_COUNT = 5

function plural(n: number, word: string): string {
    return `${n} ${n === 1 ? word : `${word}s`}`
}

// The Sunday that starts the week of this date, at local midnight.
function startOfWeek(date: Date): Date {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - start.getDay())
    return start
}

// Counts the rooms that opened in each of the last WEEKS weeks, oldest week first.
function roomsPerWeek(rooms: RoomStatSummary[], now: Date): { weekStart: Date; count: number }[] {
    const current = startOfWeek(now)
    const weeks = Array.from({ length: WEEKS }, (_, i) => {
        const day = new Date(current)
        day.setDate(current.getDate() - (WEEKS - 1 - i) * 7)
        return day
    })
    const counts = new Map<number, number>(weeks.map((w) => [w.getTime(), 0]))
    for (const room of rooms) {
        const key = startOfWeek(new Date(room.startedAt)).getTime()
        if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return weeks.map((weekStart) => ({ weekStart, count: counts.get(weekStart.getTime()) ?? 0 }))
}

// The length of each room in minutes, skipping any with an invalid time.
function sessionMinutes(rooms: RoomStatSummary[]): number[] {
    return rooms
        .map((r) => (Date.parse(r.endedAt) - Date.parse(r.startedAt)) / 60000)
        .filter((m) => Number.isFinite(m) && m >= 0)
}

// The mean length of the rooms in minutes, or null when there are no rooms with a valid length.
function averageSessionMinutes(rooms: RoomStatSummary[]): number | null {
    const lengths = sessionMinutes(rooms)
    if (lengths.length === 0) return null
    return lengths.reduce((sum, m) => sum + m, 0) / lengths.length
}

// The length of the longest room in minutes, or null when there are none.
function longestSessionMinutes(rooms: RoomStatSummary[]): number | null {
    const lengths = sessionMinutes(rooms)
    return lengths.length === 0 ? null : Math.max(...lengths)
}

// "Xm Xs", for example "2m 15s" or "0m 45s". Minutes keep counting past 60.
function formatDuration(minutes: number): string {
    const total = Math.round(minutes * 60)
    return `${Math.floor(total / 60)}m ${total % 60}s`
}

// The average session length across every room this teacher ended.
export function AverageSessionTile({ rooms }: { rooms: RoomStatSummary[] }) {
    const average = averageSessionMinutes(rooms)
    const longest = longestSessionMinutes(rooms)
    return (
        // Same look as the selected Coding / Parsons type cards in Create Activity: 2px brand outline, pop tint.
        <div className="rounded-xl border-2 border-brand bg-pop/25 p-5">
            <p className="flex items-center gap-2 text-2xl font-semibold text-[#5a52a6]">
                <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="13" r="8" />
                    <path d="M12 9v4l2 2" />
                    <path d="M5 3 2 6" />
                    <path d="m22 6-3-3" />
                    <path d="M6.38 18.7 4 21" />
                    <path d="M17.64 18.7 20 21" />
                </svg>
                Average session duration
            </p>
            <p className={`mt-6 ml-3 text-5xl font-semibold ${TEXT_PRIMARY}`}>
                {average === null ? "—" : formatDuration(average)}
            </p>
            {average === null && <p className={`mt-1 text-sm ${TEXT_SECONDARY}`}>No rooms yet</p>}
            {longest !== null && (
                <p className="mt-6 text-lg text-[#5a52a6]">
                    Longest session: <span className={`font-semibold ${TEXT_PRIMARY}`}>{formatDuration(longest)}</span>
                </p>
            )}
        </div>
    )
}

// Rooms per week as a line chart, with a crosshair tooltip and a table view.
// The chart measures its own width, so the text and strokes keep their size on phones.
export function RoomsPerWeekChart({ rooms }: { rooms: RoomStatSummary[] }) {
    // Recomputed only when the rooms change. The week windows are based on today.
    const weeks = useMemo(() => roomsPerWeek(rooms, new Date()), [rooms])
    const total = weeks.reduce((sum, w) => sum + w.count, 0)

    const boxRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(640)
    // Which week the pointer or keyboard focus is on, or null for none.
    const [active, setActive] = useState<number | null>(null)

    // Measure again whenever the chart appears, since it is not rendered for an empty list.
    const hasRooms = rooms.length > 0
    useEffect(() => {
        const el = boxRef.current
        if (!el) return
        const measure = () => setWidth(Math.max(280, el.clientWidth))
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(el)
        return () => observer.disconnect()
    }, [hasRooms])

    if (rooms.length === 0) {
        return <p className={`py-10 text-center text-sm ${TEXT_SECONDARY}`}>Rooms you run will show up here.</p>
    }

    // Geometry, in pixels. The plot sits inside the padding, which holds the axis labels.
    const HEIGHT = 220
    const PAD_L = 36
    const PAD_R = 12
    const PAD_T = 24
    const PAD_B = 28
    const plotW = width - PAD_L - PAD_R
    const plotH = HEIGHT - PAD_T - PAD_B
    const slot = plotW / weeks.length

    // A clean y-axis: whole-number ticks from 0 up to a multiple of the step.
    const peak = Math.max(1, ...weeks.map((w) => w.count))
    const step = Math.max(1, Math.ceil(peak / 4))
    const top = step * Math.ceil(peak / step)
    const ticks: number[] = []
    for (let v = 0; v <= top; v += step) ticks.push(v)

    const cx = (i: number) => PAD_L + (i + 0.5) * slot
    const cy = (v: number) => PAD_T + plotH - (v / top) * plotH

    // Label every week when there is room, otherwise every second one.
    const labelEvery = slot < 44 ? 2 : 1
    // Axis labels use the number form, for example 8/30.
    const weekLabel = (d: Date) => d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })
    const weekLongLabel = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })

    const linePath = weeks.map((w, i) => `${i === 0 ? "M" : "L"}${cx(i)},${cy(w.count)}`).join(" ")
    const areaPath = `${linePath} L${cx(weeks.length - 1)},${cy(0)} L${cx(0)},${cy(0)} Z`

    const last = weeks.length - 1
    const activeWeek = active === null ? null : weeks[active]
    // Keep the tooltip on screen near the left and right edges.
    const tipLeft = active === null ? 0 : Math.min(Math.max(cx(active), 70), width - 70)

    const summary = `Rooms run per week over the last ${WEEKS} weeks: ${plural(total, "room")} in total.`

    return (
        <div>
            <div ref={boxRef} className="relative">
                <svg
                    width={width}
                    height={HEIGHT}
                    role="img"
                    aria-label={summary}
                    className="block"
                    onPointerLeave={() => setActive(null)}
                >
                    {/* Gridlines: solid hairlines. The bottom one is the baseline. */}
                    {ticks.map((v) => (
                        <g key={v}>
                            <line
                                x1={PAD_L}
                                x2={width - PAD_R}
                                y1={cy(v)}
                                y2={cy(v)}
                                strokeWidth={1}
                                vectorEffect="non-scaling-stroke"
                                className={v === 0 ? "stroke-[#c3c2b7] dark:stroke-[#383835]" : "stroke-[#e1e0d9] dark:stroke-[#2c2c2a]"}
                            />
                            <text x={PAD_L - 8} y={cy(v) + 4} textAnchor="end" className={`${TEXT_MUTED} text-[13px] font-bold`}>
                                {v}
                            </text>
                        </g>
                    ))}

                    {/* Area wash under the line, at about 10% of the series color. */}
                    <path d={areaPath} className="fill-[#221574]/10 dark:fill-[#a6cfd5]/10" />

                    {/* The line itself. */}
                    <path
                        d={linePath}
                        fill="none"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        className="stroke-[#221574] dark:stroke-[#a6cfd5]"
                    />

                    {/* Crosshair on the active week. */}
                    {active !== null && (
                        <line
                            x1={cx(active)}
                            x2={cx(active)}
                            y1={PAD_T}
                            y2={PAD_T + plotH}
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                            className="stroke-[#898781]"
                        />
                    )}

                    {/* Week labels on the x-axis. */}
                    {weeks.map((w, i) =>
                        i % labelEvery === 0 || i === last ? (
                            <text key={i} x={cx(i)} y={HEIGHT - 8} textAnchor="middle" className={`${TEXT_MUTED} text-[13px] font-bold`}>
                                {weekLabel(w.weekStart)}
                            </text>
                        ) : null
                    )}

                    {/* Dots: each has a surface ring so it stays readable on the line. */}
                    {weeks.map((w, i) => (
                        <circle
                            key={`dot-${i}`}
                            cx={cx(i)}
                            cy={cy(w.count)}
                            r={active === i ? 5 : 4}
                            strokeWidth={2}
                            className="fill-[#221574] stroke-white dark:fill-[#a6cfd5] dark:stroke-[#1a1a19]"
                        />
                    ))}

                    {/* Direct label on the latest week, the one value the reader most needs. */}
                    <text x={cx(last)} y={cy(weeks[last].count) - 10} textAnchor="middle" className="text-[14px] font-bold fill-[#5a52a6]">
                        {weeks[last].count}
                    </text>

                    {/* One hit area per week, covering the full height of the column. Keyboard focus shows the same as hover. */}
                    {weeks.map((w, i) => (
                        <rect
                            key={`hit-${i}`}
                            x={PAD_L + i * slot}
                            y={PAD_T}
                            width={slot}
                            height={plotH}
                            tabIndex={0}
                            aria-label={`Week of ${weekLongLabel(w.weekStart)}: ${plural(w.count, "room")}`}
                            onPointerEnter={() => setActive(i)}
                            onFocus={() => setActive(i)}
                            onBlur={() => setActive(null)}
                            className="fill-transparent outline-none focus-visible:fill-[#221574]/10 dark:focus-visible:fill-[#a6cfd5]/10"
                        />
                    ))}
                </svg>

                {activeWeek && (
                    <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-brand/20 bg-white px-2.5 py-1.5 text-sm shadow-sm dark:border-white/10 dark:bg-[#1a1a19] ${TEXT_SECONDARY}`}
                        style={{ left: tipLeft }}
                    >
                        <span className={`block font-semibold ${TEXT_PRIMARY}`}>{plural(activeWeek.count, "room")}</span>
                        Week of {weekLongLabel(activeWeek.weekStart)}
                    </div>
                )}
            </div>
        </div>
    )
}

// The most recent rooms, newest first: when each opened, its activity, and how many students joined.
export function RecentRoomsTable({ rooms }: { rooms: RoomStatSummary[] }) {
    const recent = useMemo(
        () => [...rooms].sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0)).slice(0, RECENT_COUNT),
        [rooms]
    )

    if (recent.length === 0) {
        return <p className={`text-sm ${TEXT_SECONDARY}`}>No rooms yet.</p>
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className={`w-full text-left text-base ${TEXT_PRIMARY}`}>
                    <thead>
                        <tr className={`border-b border-[#5a52a6] dark:border-white/10 ${TEXT_PRIMARY}`}>
                            <th scope="col" className="py-2 pr-4 text-lg font-bold">Date</th>
                            <th scope="col" className="py-2 pr-4 text-lg font-bold">Activity</th>
                            <th scope="col" className="py-2 text-right text-lg font-bold">Students</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.map((room) => (
                            <tr key={room.code} className="border-b border-[#5a52a6] last:border-0 dark:border-white/10">
                                <td className="whitespace-nowrap py-2 pr-4">
                                    {new Date(room.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                                </td>
                                <td className="py-2 pr-4 break-words">
                                    <Link to={`/previous-rooms/${encodeURIComponent(room.code)}`} className="underline text-brand hover:text-[#5a52a6] dark:text-brand-light">
                                        {room.activityName || "Activity"}
                                    </Link>
                                </td>
                                <td className="py-2 text-right tabular-nums">{room.studentCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Link to="/dashboard/previous-activities" className="mt-3 inline-block rounded-xl border-2 border-brand bg-pop/25 px-4 py-2 text-base text-[#5a52a6] hover:bg-brand hover:text-white">
                See all previous activities
            </Link>
        </div>
    )
}

// Shared card wrapper for the dashboard stats. `selected` gives the same look as the selected
// Coding / Parsons type cards in Create Activity: 2px brand outline and the pop tint.
export function StatCard({ title, children, className = "", selected = false }: { title: string; children: ReactNode; className?: string; selected?: boolean }) {
    const look = selected ? "rounded-xl border-2 border-brand bg-pop/25 p-5" : CARD
    return (
        <section className={`${look} ${className}`}>
            <h2 className={`mb-4 text-2xl font-semibold ${TEXT_PRIMARY}`}>{title}</h2>
            {children}
        </section>
    )
}
