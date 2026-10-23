export interface ChatTab {
  id: string;
  label: string;
}

interface ChatTabsProps {
  tabs: ChatTab[];
  activeId: string;
  // New messages per chat id that the user has not seen yet.
  unread: Record<string, number>;
  onSelect: (id: string) => void;
}

// The bar of chats above the message input: the group chat, then one tab per
// private chat. A number on a tab counts messages that arrived while it was hidden.
export default function ChatTabs({ tabs, activeId, unread, onSelect }: ChatTabsProps) {
  return (
    <div role="tablist" aria-label="Chats" className="flex gap-2 overflow-x-auto px-3 pt-2">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const count = unread[tab.id] ?? 0;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={
              active
                ? "flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white cursor-pointer"
                : "flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 cursor-pointer hover:bg-neutral-100"
            }
            onClick={() => onSelect(tab.id)}
          >
            <span className="max-w-[12rem] truncate">{tab.label}</span>
            {count > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold leading-5 text-white tabular-nums">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
