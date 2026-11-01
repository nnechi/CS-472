import * as Avatar from "@radix-ui/react-avatar"

interface UserAvatarProps {
    name: string
    picture?: string | null
    // "md" is the dashboard header size. "sm" fits beside a chat message.
    size?: "sm" | "md"
}

const SIZES = {
    sm: { root: "h-8 w-8 border border-brand/30", text: "text-xs" },
    md: { root: "h-12 w-12", text: "text-base" },
}

// A profile picture. Shows the person's initials when they have no picture
// (students never do) or it fails to load.
export default function UserAvatar({ name, picture, size = "md" }: UserAvatarProps) {
    const initials = name
        .split(" ")
        .filter((word) => word !== "")
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join("")

    return (
        <Avatar.Root
            className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-white ${SIZES[size].root}`}
            title={name}
        >
            {picture && (
                <Avatar.Image
                    className="h-full w-full object-cover"
                    src={picture}
                    alt={name}
                    // Google picture URLs can refuse to load when a referrer is sent.
                    referrerPolicy="no-referrer"
                />
            )}
            <Avatar.Fallback className={`${SIZES[size].text} font-semibold text-brand`}>
                {initials}
            </Avatar.Fallback>
        </Avatar.Root>
    )
}
