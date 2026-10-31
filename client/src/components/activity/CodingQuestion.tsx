import { ACTIVITY_MAX_LENGTH, ActivityQuestion } from "../../types"

interface CodingQuestionProps {
    item : ActivityQuestion
    onChange : (changes : Partial<ActivityQuestion>) => void
}

// The fields for a coding question: students write code that prints this output.
export default function CodingQuestion({ item, onChange } : CodingQuestionProps){
    return (
        <label className="flex flex-col gap-1 text-sm text-gray-600">
            Correct output
            <textarea
                className="min-h-32 rounded-lg border border-gray-300 p-3 text-base text-black focus:border-indigo-600 focus:outline-none"
                value={item.output}
                onChange={(e) => onChange({ output: e.target.value })}
                placeholder="Enter the correct output for the question..."
                maxLength={ACTIVITY_MAX_LENGTH}
                required
            />
        </label>
    )
}
