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
}

// This component represents the interface for when it is a code editor activity. Has 4 
// resizable quadrants - question area, code area, correct output, student output
// Used by both student room and teacher room
export default function CodeEditor({ activity, currentQuestion, role } : CodeEditorProps){
    const [code, setCode] = useState("");
    const language = activity?.language === "c++" ? "cpp" : activity?.language;
    const canRun = !!language && ["python", "javascript", "typescript", "java", "c", "cpp"].includes(language);
    const [output, setOutput] = useState("");
    const [running, setRunning] = useState(false);
    const requestRef = useRef<AbortController | null>(null);
    useEffect(() => () => requestRef.current?.abort(), []);
    useEffect(() => {
        requestRef.current?.abort();
        requestRef.current = null;
        setRunning(false);
        setCode("");
        setOutput("");
    }, [activity, currentQuestion]);

    async function runCode() {
        if (requestRef.current || !canRun) return;
        const controller = new AbortController();
        requestRef.current = controller;
        setRunning(true);
        setOutput("Running…");
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

    // The index in the questions array of the current question
    const index = Math.min(currentQuestion, activity.questions.length - 1);

    // The current question itself, pulled from the questions array
    const question = activity.questions[index];

    // Function for Monaco editor to set editor options on mount
    const handleMount: OnMount = (editor, _monaco) => {
        editor.setPosition({ lineNumber: 2, column: 1 });
        editor.focus();
    };

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* Display the current question number out of the total number of questions */}
            <p className="text-xl font-semibold">
                Question {index + 1} of {activity.questions.length}
            </p>

            <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="rounded border px-4 py-2 disabled:opacity-50"
                    disabled={running || !code.trim() || !canRun} onClick={runCode}>{running ? "Running…" : "Run"}</button>
                {running && <button type="button" onClick={() => requestRef.current?.abort()}>Stop</button>}
            </div>
            {!canRun && <p className="text-sm text-gray-600">{language ? `Execution is not available for this activity’s language (${activity.language}).` : "The teacher needs to set a programming language for this activity."}</p>}
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
                        options={{ fontSize: 18, readOnly: running, automaticLayout: true }}
                        onMount={handleMount}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Quadrant 4 - Student output */}
                <ResizablePanel defaultSize="25%">
                    <div className="flex h-full flex-col gap-2 overflow-auto p-6">
                        <p className="font-semibold text-2xl">{role === "student" ? "Your" : "Student"} Output</p>
                        <pre aria-live="polite" aria-label="Execution output" className="whitespace-pre-wrap font-mono text-sm">{output || "Run your code to see output here."}</pre>
                    </div>
                </ResizablePanel>
                </ResizablePanelGroup>
            </ResizablePanel>
            </ResizablePanelGroup>
        </section>
    )
}