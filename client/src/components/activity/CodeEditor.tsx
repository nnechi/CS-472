import { useEffect, useRef, useState } from "react";
import { SERVER_URL } from "../../api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import Editor, { OnMount } from "@monaco-editor/react";
import type { RoomActivity } from "../../types"

interface CodeEditorProps {
    // The current activtity being used in the room
    activity: RoomActivity | null;

    // The question the teacher picked. Students can't change it.
    currentQuestion: number;

    // The role of the user, either student or teacher
    role: "student" | "teacher";

    // Controlled mode (the student room): the code and last output of the current
    // question, kept by the room so changing question does not wipe them.
    code?: string;
    onCodeChange?: (code: string) => void;
    output?: string | null;
    onOutputChange?: (output: string | null) => void;

    // Nothing can be edited or run: a teacher viewing one student's work, or the
    // class activity of a saved (ended) room.
    readOnly?: boolean;
    // That student's code and last output for every question, or null if they have not started.
    // Left undefined when no student is being viewed (the ended room's class activity).
    teacherProgress?: { codes: string[]; outputs: (string | null)[] } | null;
}

// This component represents the interface for when it is a code editor activity. Has 4
// resizable quadrants - question area, code area, correct output, student output
// Used by both student room and teacher room
export default function CodeEditor({
    activity,
    currentQuestion,
    role,
    code: controlledCode,
    onCodeChange,
    output: controlledOutput,
    onOutputChange,
    readOnly = false,
    teacherProgress,
} : CodeEditorProps){
    // Local code and output, used when the caller does not control them (the teacher's playground).
    const [localCode, setLocalCode] = useState("");
    const [localOutput, setLocalOutput] = useState("");
    const codeControlled = controlledCode !== undefined;
    const outputControlled = controlledOutput !== undefined;
    const language = activity?.language === "c++" ? "cpp" : activity?.language;
    const canRun = !!language && ["python", "javascript", "typescript", "java", "c", "cpp"].includes(language);
    const [running, setRunning] = useState(false);
    const requestRef = useRef<AbortController | null>(null);
    useEffect(() => () => requestRef.current?.abort(), []);
    useEffect(() => {
        requestRef.current?.abort();
        requestRef.current = null;
        setRunning(false);
        setLocalCode("");
        setLocalOutput("");
    }, [activity, currentQuestion]);

    // The index in the questions array of the current question
    const questionCount = activity?.questions.length ?? 0;
    const index = Math.max(0, Math.min(currentQuestion, questionCount - 1));

    // A student's saved work wins when the teacher is viewing it.
    const code = readOnly
        ? teacherProgress?.codes[index] ?? ""
        : codeControlled ? controlledCode : localCode;
    const output = readOnly
        ? teacherProgress?.outputs[index] ?? ""
        : (outputControlled ? controlledOutput : localOutput) ?? "";

    const setCode = (next: string) => {
        if (readOnly) return;
        if (codeControlled) onCodeChange?.(next);
        else setLocalCode(next);
    };
    const setOutput = (next: string) => {
        if (outputControlled) onOutputChange?.(next);
        else setLocalOutput(next);
    };

    async function runCode() {
        if (requestRef.current || !canRun || readOnly) return;
        const controller = new AbortController();
        requestRef.current = controller;
        // "Running…" is shown from the running flag, so it never gets saved as the output.
        setRunning(true);
        try {
            const response = await fetch(`${SERVER_URL}/api/compile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, language }),
                signal: controller.signal,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Execution failed.");
            const status = result.timedOut ? "Time limit exceeded" : result.outputLimitExceeded
                ? "Output limit exceeded" : `Exit code: ${result.exitCode ?? "unknown"}`;
            if (requestRef.current === controller)
                setOutput(`${result.stdout}${result.stderr ? "\n[stderr]\n" + result.stderr : ""}\n${status}`);
        } catch (error) {
            if (requestRef.current === controller)
                setOutput(controller.signal.aborted ? "Stopped." : error instanceof Error ? error.message : "Execution failed.");
        } finally {
            if (requestRef.current === controller) {
                requestRef.current = null;
                setRunning(false);
            }
        }
    }

    // Display a message when there is no activity currently selected or the activity has no questions
    // Realistically this shouldn't appear
    if (!activity || activity.questions.length === 0) {
        return (
        <section className="flex flex-1 flex-col p-4">
            <p className="text-gray-500">Your teacher hasn't picked an activity yet.</p>
        </section>
        );
    }

    // The current question itself, pulled from the questions array
    const question = activity.questions[index];

    // Function for Monaco editor to set editor options on mount
    const handleMount: OnMount = (editor, _monaco) => {
        if (readOnly) return;
        editor.setPosition({ lineNumber: 2, column: 1 });
        editor.focus();
    };

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* Display the current question number out of the total number of questions */}
            <p className="text-xl font-semibold">
                Question {index + 1} of {activity.questions.length}
            </p>

            {readOnly ? (
                teacherProgress === null && <p className="text-sm text-gray-600">This student hasn't written any code yet.</p>
            ) : (
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="rounded border px-4 py-2 disabled:opacity-50"
                    disabled={running || !code.trim() || !canRun} onClick={runCode}>{running ? "Running…" : "Run"}</button>
                {running && <button type="button" onClick={() => requestRef.current?.abort()}>Stop</button>}
            </div>
            )}
            {!canRun && !readOnly && <p className="text-sm text-gray-600">{language ? `Execution is not available for this activity’s language (${activity.language}).` : "The teacher needs to set a programming language for this activity."}</p>}
            {/* 4 quadrants */}
            <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-0 flex-1 rounded-lg border"
            >
            <ResizablePanel defaultSize="30%">
                <ResizablePanelGroup orientation="vertical">
                {/* Quadrant 1 - Question area */}
                <ResizablePanel defaultSize="55%">
                    <div className="flex h-full p-6">
                        <p className="font-semibold text-2xl">{question.question}</p>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Quadrant 3 - Correct output */ }
                <ResizablePanel defaultSize="45%">
                    <div className="flex h-full flex-col gap-3 p-6">
                        <p className="text-2xl font-semibold">Correct Output</p>
                        <p className="text-lg">{question.output}</p>
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
                        onChange={(value) => setCode(value ?? "")}
                        options={{ fontSize: 18, readOnly: readOnly || running, automaticLayout: true }}
                        onMount={handleMount}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Quadrant 4 - Student output */}
                <ResizablePanel defaultSize="25%">
                    <div className="flex h-full flex-col gap-2 overflow-auto p-6">
                        <p className="font-semibold text-2xl">{role === "student" ? "Your" : "Student"} Output</p>
                        <pre aria-live="polite" aria-label="Execution output" className="whitespace-pre-wrap font-mono text-sm">{running && !readOnly ? "Running…" : output || (readOnly ? (teacherProgress === undefined ? "No output." : "This student hasn't run this code yet.") : "Run your code to see output here.")}</pre>
                    </div>
                </ResizablePanel>
                </ResizablePanelGroup>
            </ResizablePanel>
            </ResizablePanelGroup>
        </section>
    )
}