import Editor, { OnMount } from "@monaco-editor/react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { RoomActivity } from "../../types"
import type { RunState } from "../../hooks/useRoomSocket"

// The activity languages that have a runner on the server.
const RUNNABLE = ["python", "javascript", "typescript", "java", "c", "c++"];

interface CodeEditorProps {
    // The current activtity being used in the room
    activity: RoomActivity | null;

    // The question the teacher picked. Students can't change it.
    currentQuestion: number;

    // The role of the user, either student or teacher
    role: "student" | "teacher";

    // The code for each question, and the latest run.
    codes?: string[];
    run?: RunState;
    // The output of each question's last finished run. Shown when the run on
    // screen isn't from this question, e.g. when showing a student's saved work.
    outputs?: (string | null)[];
    // Shown instead of the output placeholder when read-only, e.g. a student
    // who hasn't started yet.
    emptyMessage?: string;

    // Left out to make the editor read-only, e.g. when showing someone else's work.
    onCodeChange?: (questionIndex: number, code: string) => void;
    // Left out to hide the Run and Stop buttons.
    onRun?: (questionIndex: number, code: string) => void;
    onCancel?: () => void;
}

// What to show under the output: where the run is, or how it ended.
function runStatus(run: RunState): string | null {
    if (run.status === "queued") return run.position === 1 ? "Up next…" : `Waiting in line (#${run.position})…`;
    if (run.status === "running") return "Running…";
    if (run.error) return run.error;
    const outcome = run.outcome;
    if (!outcome) return null;
    switch (outcome.type) {
        case "finished":
            return outcome.result.timedOut ? "Time limit exceeded"
                : outcome.result.outputLimitExceeded ? "Output limit exceeded"
                : `Exit code: ${outcome.result.exitCode ?? "unknown"}`;
        case "cancelled":
            return "Stopped.";
        case "error":
            return outcome.message;
        case "replaced":
            return null;
    }
}

// This component represents the interface for when it is a code editor activity. Has 4
// resizable quadrants - question area, code area, correct output, student output.
// Used by both student room and teacher room. It keeps no state of its own: the
// code and the run come in as props and changes go out through the callbacks,
// so it can show someone's own work or, read-only, someone else's.
export default function CodeEditor({
    activity,
    currentQuestion,
    role,
    codes = [],
    run,
    outputs = [],
    emptyMessage,
    onCodeChange,
    onRun,
    onCancel,
}: CodeEditorProps){
    const readOnly = !onCodeChange;
    const language = activity?.language === "c++" ? "cpp" : activity?.language;
    const canRun = !!activity?.language && RUNNABLE.includes(activity.language);

    // Display a message when there is no activity currently selected or the activity has no questions
    // Realistically this shouldn't appear
    if (!activity || activity.questions.length === 0) {
        return (
        <section className="flex flex-1 flex-col p-4">
            <p className="text-gray-500">Your teacher hasn't picked an activity yet.</p>
        </section>
        );
    }

    // The index in the questions array of the current question
    const index = Math.min(currentQuestion, activity.questions.length - 1);

    // The current question itself, pulled from the questions array
    const question = activity.questions[index];

    // This question's code.
    const code = codes[index] ?? "";

    // The run only belongs on screen if it was started from this question.
    const runHere = run && run.questionIndex === index ? run : undefined;
    // Waiting in line or running: Run is off until it's done, Stop is on.
    const busy = runHere?.status === "queued" || runHere?.status === "running";
    const status = runHere ? runStatus(runHere) : null;
    const output = runHere ? runHere.output : outputs[index] ?? "";

    // Function for Monaco editor to set editor options on mount
    const handleMount: OnMount = (editor, _monaco) => {
        if (readOnly) return;
        editor.setPosition({ lineNumber: 2, column: 1 });
        editor.focus();
    };

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* The question number on the left, Run (and Stop while busy) on the right. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xl font-semibold">
                    Question {index + 1} of {activity.questions.length}
                </p>

                {onRun && (
                    <div className="flex flex-wrap items-center gap-3">
                        {busy && onCancel && <button type="button" onClick={onCancel}>Stop</button>}
                        {/* Green on white; the shadow grows on hover. No hover effect while disabled. */}
                        <button type="button"
                            className="cursor-pointer rounded-lg border border-green-600 bg-white px-4 py-2 font-semibold text-green-700 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
                            disabled={busy || !code.trim() || !canRun}
                            onClick={() => onRun(index, code)}>
                            {runHere?.status === "running" ? "Running…" : runHere?.status === "queued" ? "Waiting…" : "Run"}
                        </button>
                    </div>
                )}
            </div>
            {!canRun && !readOnly && <p className="text-sm text-gray-600">{activity.language ? `Execution is not available for this activity’s language (${activity.language}).` : "The teacher needs to set a programming language for this activity."}</p>}
            {/* 4 quadrants */}
            <ResizablePanelGroup
            orientation="horizontal"
            className="h-[90vh] min-h-[600px] shrink-0 rounded-lg border"
            >
            <ResizablePanel defaultSize="30%">
                <ResizablePanelGroup orientation="vertical">
                {/* Quadrant 1 - Question area */}
                <ResizablePanel defaultSize="55%">
                    <div className="flex h-full p-6">
                        <p className="font-semibold text-2xl whitespace-pre-wrap">{question.question}</p>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Quadrant 3 - Correct output */ }
                <ResizablePanel defaultSize="45%">
                    <div className="flex h-full flex-col gap-3 p-6">
                        <p className="text-2xl font-semibold">Correct Output</p>
                        <p className="text-lg whitespace-pre-wrap">{question.output}</p>
                    </div>
                </ResizablePanel>
                </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="70%">
                <ResizablePanelGroup orientation="vertical">

                {/* Quadrant 2 - Code area */}
                <ResizablePanel defaultSize="75%">
                    <Editor
                        language={language === "other" || !language ? "plaintext" : language}
                        value={code}
                        onChange={(value) => onCodeChange?.(index, value ?? "")}
                        options={{ fontSize: 18, readOnly, automaticLayout: true }}
                        onMount={handleMount}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Quadrant 4 - Output: your own runs, or the student's when showing their work */}
                <ResizablePanel defaultSize="25%">
                    <div className="flex h-full flex-col gap-2 overflow-auto p-6">
                        <p className="font-semibold text-2xl">{onRun ? "Your" : "Student"} Output</p>
                        <pre aria-live="polite" aria-label="Execution output" className="whitespace-pre-wrap font-mono text-sm">
                            {/* Output, then the status under it. The placeholder only shows when there's neither. */}
                            {output}
                            {status && `${output ? "\n" : ""}${status}`}
                            {!output && !status && (onRun ? "Run your code to see output here." : emptyMessage ?? (role === "teacher" ? "Student output will appear here." : ""))}
                        </pre>
                    </div>
                </ResizablePanel>
                </ResizablePanelGroup>
            </ResizablePanel>
            </ResizablePanelGroup>
        </section>
    )
}
