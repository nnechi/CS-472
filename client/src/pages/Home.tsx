
export default function Home() {
    return (
        <main className="px-6 py-16 sm:px-12">
            <section className="mx-auto max-w-5xl text-center">
                <h1 className="text-5xl font-bold leading-tight sm:text-7xl">
                    Programming Practice Made Fun
                </h1>
                <p className="mt-4">
                    A new way for students to practice programming in class with real-time feedback.
                </p>
            </section>

            <section className="mx-auto mt-24 max-w-6xl">
                <h2 className="text-4xl">Ready in three steps</h2>
                <ol className="mt-10 grid list-none gap-10 p-0 md:grid-cols-3">
                    <li>
                        <div className="flex items-center gap-6">
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border text-5xl">
                                1
                            </span>
                            <h3 className="text-3xl">Create a room</h3>
                        </div>
                        <p className="mt-8 text-2xl">
                            The teacher picks an activity and gets a room code.
                        </p>
                    </li>
                    <li>
                        <div className="flex items-center gap-6">
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border text-5xl">
                                2
                            </span>
                            <h3 className="text-3xl">Join with the code</h3>
                        </div>
                        <p className="mt-8 text-2xl">
                            Students type the code and land straight in the coding screen.
                        </p>
                    </li>
                    <li>
                        <div className="flex items-center gap-6">
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border text-5xl">
                                3
                            </span>
                            <h3 className="text-3xl">Code, run, get help</h3>
                        </div>
                        <p className="mt-8 text-2xl">
                            Run the code, compare the output, and the teacher jump in when you are stuck.
                        </p>
                    </li>
                </ol>
            </section>
        </main>
    )
}
