import { RaisedHand } from "../types";

const buttonClass =
  "rounded-lg border border-indigo-600 px-3 py-1.5 text-sm text-indigo-600 cursor-pointer hover:bg-indigo-50";

interface HandQueueProps {
  queue: RaisedHand[];
  onLowerHand: (id: string) => void;
  onOpenPrivateChat: (studentId: string) => void;
}

// Teachers: students needing help, in the order they asked. Click a name once
// you've helped them, or open a private chat with them.
export function HandQueue({ queue, onLowerHand, onOpenPrivateChat }: HandQueueProps) {
  return (
    <div className="border-b border-gray-200 px-4 py-2 text-sm">
      <span className="font-semibold">Needs help ({queue.length})</span>
      {queue.length === 0 ? (
        <span className="ml-2 text-gray-500">No raised hands</span>
      ) : (
        <ol className="mt-1.5 list-decimal pl-6">
          {queue.map((h) => (
            <li key={h.id} className="mb-1">
              <span className="inline-flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md bg-indigo-100 px-2.5 py-1 text-sm text-indigo-700 cursor-pointer hover:line-through"
                  title="Click once you've helped this student"
                  onClick={() => onLowerHand(h.id)}
                >
                  {h.username}
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  title="Open a private chat with this student"
                  onClick={() => onOpenPrivateChat(h.id)}
                >
                  Private chat
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface RaiseHandButtonProps {
  raised: boolean;
  onToggle: () => void;
}

// Students: click once to ask for help, again to cancel.
export function RaiseHandButton({ raised, onToggle }: RaiseHandButtonProps) {
  return (
    <div className="border-b border-gray-200 px-4 py-2">
      <button
        type="button"
        className={
          raised ? `${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700` : buttonClass
        }
        onClick={onToggle}
      >
        {raised ? "Lower hand" : "Raise hand"}
      </button>
    </div>
  );
}
