import type { RoomActivity } from "../../types"
import { activityLanguageLabel } from "../../utils/activityLabels"

interface ActivityInfoProps {
    activity: RoomActivity | null
}

const PILL_CLASS = "shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"

// The room's activity, shown in both the teacher's and the student's header so
// everyone sees the same thing: "Playing: <name>", then the supported language
// of a coding activity, or a "Parsons problem" pill. Shows nothing when the
// room has no activity.
export default function ActivityInfo({ activity }: ActivityInfoProps) {
    if (!activity) return null
    const language = activityLanguageLabel(activity)

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand">
            {/* Names can be up to 100 characters: cut them off, full name on hover. */}
            <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-brand/70">Playing:</span>
                <span className="truncate font-semibold" title={activity.name}>{activity.name}</span>
            </span>

            {language && (
                <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-brand/70">Supported Language(s):</span>
                    <span className={PILL_CLASS}>{language}</span>
                </span>
            )}
            {activity.type === "parsons" && <span className={PILL_CLASS}>Parsons problem</span>}
        </div>
    )
}
