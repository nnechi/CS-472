import { useEffect, useRef, useState } from "react";
import { RaisedHand } from "../types";
import { Check, Hand, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HandQueueProps {
  queue: RaisedHand[];
  onLowerHand: (id: string) => void;
  onOpenPrivateChat: (studentId: string) => void;
}

// Teachers: students needing help, in the order they asked. Each row can be
// marked helped (lowers the hand) or opened as a private chat.
export function HandQueue({ queue, onLowerHand, onOpenPrivateChat }: HandQueueProps) {
  const needsHelp = queue.length > 0;

  return (
    <section
      aria-label="Students needing help"
      className={cn(
        "overflow-hidden rounded-lg border bg-white transition-colors",
        needsHelp ? "border-2 border-red-400 shadow-sm" : "border border-brand/15 shadow-md"
      )}
    >
      <header className="flex items-center gap-2 bg-brand px-4 py-2.5">
        <Hand className="size-4 text-white" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-white">Needs help</h2>
        <span className="ml-auto rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-bold tabular-nums text-brand">
          {queue.length}
        </span>
      </header>

      <div className="p-3">
        {queue.length === 0 ? (
          <p className="px-1 py-1.5 text-sm text-brand/60">No hands raised right now.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {queue.map((h, i) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-3 rounded-r-lg border-l-4 border-red-300 bg-paper px-3 py-2"
              >
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold tabular-nums text-brand"
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm font-semibold text-brand">
                  {h.username}
                </span>
                <TooltipProvider>
                  <span className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            aria-label={`Mark ${h.username} as helped`}
                            className="size-9 rounded-full bg-pop text-brand shadow-sm hover:bg-pop/80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                            onClick={() => onLowerHand(h.id)}
                          >
                            <Check />
                          </Button>
                        }
                      />
                      <TooltipContent>Mark as helped</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            aria-label={`Open private chat with ${h.username}`}
                            className="size-9 rounded-full bg-brand text-white shadow-sm hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                            onClick={() => onOpenPrivateChat(h.id)}
                          >
                            <MessageSquare />
                          </Button>
                        }
                      />
                      <TooltipContent>Private chat</TooltipContent>
                    </Tooltip>
                  </span>
                </TooltipProvider>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

interface HandRaiseAlertProps {
  // How many students currently have a hand raised.
  count: number;
  // Whether the Needs help box is open, and the click that opens or closes it.
  open: boolean;
  onToggle: () => void;
}

// Teacher header: a compact, glanceable version of the hand queue above. Not
// interactive itself (the full queue is always visible in the room below) --
// it glows red for as long as anyone is waiting (cleared the moment the
// queue empties), with a single brief pop the moment it first becomes
// urgent, and always reports the current count to screen readers via its
// status role.
export function HandRaiseAlert({ count, open, onToggle }: HandRaiseAlertProps) {
  const [justRaised, setJustRaised] = useState(false);
  const previousCount = useRef(count);
  const needsHelp = count > 0;

  useEffect(() => {
    // Only pop on the empty-to-non-empty transition. Firing it again on every
    // later raise (2nd student, 3rd student...) would mean flashing
    // repeatedly through a busy class -- the steady glow and the updating
    // count already cover those.
    if (previousCount.current === 0 && count > 0) {
      setJustRaised(true);
      const id = setTimeout(() => setJustRaised(false), 1200);
      previousCount.current = count;
      return () => clearTimeout(id);
    }
    previousCount.current = count;
  }, [count]);

  const label = needsHelp ? `${count} student${count === 1 ? "" : "s"} need help` : "No students currently need help";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Hide the Needs help box" : "Show the Needs help box"}
      className="relative inline-flex cursor-pointer rounded-full"
    >
      <span
        role="status"
        aria-label={label}
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none",
          needsHelp
            ? "border-red-500 bg-red-50 text-red-600 ring-4 ring-red-100"
            : "border-brand/40 bg-white text-brand",
          justRaised && "motion-safe:animate-[pulse_0.6s_ease-in-out_1]"
        )}
      >
        <Hand className="size-5" aria-hidden="true" />
      </span>
      {needsHelp && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold leading-5 tabular-nums text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
          }
        />
        <TooltipContent>Raised hands</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RaiseHandButtonProps {
  raised: boolean;
  onToggle: () => void;
}

// Students: click once to ask for help, again to cancel.
export function RaiseHandButton({ raised, onToggle }: RaiseHandButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={raised ? "Lower Hand" : "Raise Hand"}
              aria-pressed={raised}
              className={cn(
                "size-11 cursor-pointer rounded-full border-2 shadow-sm transition-colors",
                raised
                  ? "border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white"
                  : "border-brand/40 bg-white text-brand hover:bg-brand/10 hover:text-brand"
              )}
              onClick={onToggle}
            >
              <Hand className="size-5" />
            </Button>
          }
        />
        <TooltipContent>{raised ? "Lower Hand" : "Raise Hand"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
