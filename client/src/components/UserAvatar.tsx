import * as Avatar from "@radix-ui/react-avatar"

interface UserAvatarProps {
    name: string
    picture?: string | null
}

// The teacher's profile picture. Shows their initials when they have no picture
// or it fails to load.
export default function UserAvatar({ name, picture }: UserAvatarProps) {
    const initials = name
        .split(" ")
        .filter((word) => word !== "")
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join("")

    return (
        <Avatar.Root
            className="inline-flex h-12 w-12 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-neutral-200"
            title={name}
        >
            {picture && (
                <Avatar.Image className="h-full w-full object-cover" src={picture} alt={name} />
            )}
            <Avatar.Fallback className="text-base font-semibold text-gray-700">
                {initials}
            </Avatar.Fallback>
        </Avatar.Root>
    )
}
