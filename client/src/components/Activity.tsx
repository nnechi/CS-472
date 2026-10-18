interface ActivityProps {
    name: string
}

export default function Activity({ name } : ActivityProps){
    return (
        <div className="rounded-lg border border-gray-400 p-4">
            <div className="flex items-center justify-between">
                <p className="text-lg">{name}</p>
                <button
                    type="button"
                    className="text-lg rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                >
                    Start Room
                </button>
            </div>
        </div>
    )
}