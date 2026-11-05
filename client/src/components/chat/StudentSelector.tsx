import { Users } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectIcon,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { RosterStudent } from "../../types"

interface StudentSelectorProps {
    // The room's students: the live roster, or everyone who joined a saved room.
    students: RosterStudent[]
    // The selected student's id, or null when the class activity is shown.
    selectedId: string | null
    onSelect: (id: string | null) => void
}

// The "Class activity" item's value. Picking it clears the selection.
const CLASS_ACTIVITY = "__class_activity__"

// Lets the teacher pick one student to see their work on the activity, or
// "Class activity" to go back to the class view. The caller keeps the selection.
export default function StudentSelector({ students, selectedId, onSelect }: StudentSelectorProps) {
    const hasStudents = students.length > 0

    return (
        <Select
            value={selectedId}
            onValueChange={(value) => onSelect(!value || value === CLASS_ACTIVITY ? null : value)}
            disabled={!hasStudents}
            items={[
                { value: CLASS_ACTIVITY, label: "Class activity" },
                ...students.map((s) => ({ value: s.id, label: s.username })),
            ]}
        >
            <SelectTrigger aria-label="Select a student">
                <Users className="size-4 shrink-0 text-brand/60" aria-hidden="true" />
                <SelectValue placeholder={hasStudents ? "Select a student" : "No students yet"} />
                <SelectIcon />
            </SelectTrigger>
            <SelectContent aria-label="Students in this room">
                <SelectItem value={CLASS_ACTIVITY}>Class activity</SelectItem>
                {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                        {student.username}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
