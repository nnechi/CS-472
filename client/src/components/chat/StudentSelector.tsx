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
    // Everyone currently connected to this specific room, from the live roster.
    students: RosterStudent[]
    // The selected student's id, or null when none is selected.
    selectedId: string | null
    onSelect: (id: string | null) => void
}

// Lets the teacher pick one connected student from the room's live roster.
// For now this only tracks which student is selected (via selectedId/onSelect)
// -- a future live-screen-viewing feature can read the selection from
// wherever the caller keeps it without this component changing shape.
export default function StudentSelector({ students, selectedId, onSelect }: StudentSelectorProps) {
    const hasStudents = students.length > 0

    return (
        <Select
            value={selectedId}
            onValueChange={onSelect}
            disabled={!hasStudents}
            items={students.map((s) => ({ value: s.id, label: s.username }))}
        >
            <SelectTrigger aria-label="Select a student">
                <Users className="size-4 shrink-0 text-brand/60" aria-hidden="true" />
                <SelectValue placeholder={hasStudents ? "Select a student" : "No students yet"} />
                <SelectIcon />
            </SelectTrigger>
            <SelectContent aria-label="Students in this room">
                {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                        {student.username}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
