import { CodeXml, Ticket, Users } from "lucide-react"
import wideLogo from "../assets/LittlePointers Logo/Full Logo Wide.png"

export default function Home() {
    return (
      <div>
            <section className="mx-auto max-w-5xl text-center">
                <img src={wideLogo} alt="LittlePointers" className="mx-auto -mt-8 mb-6 h-40 w-auto sm:h-56" />
                <h1 className="text-[2.75rem] font-bold leading-tight sm:text-[4.1rem]">
                    Programming Practice Made Fun
                </h1>
                <p className="mt-4 text-[1.125rem] text-brand/70 sm:text-[1.35rem]">
                    A new way for students to practice programming in class with real-time feedback.
                </p>
            </section>

            <section className="mx-auto mt-6 max-w-6xl">
                <h2 className="text-[2.05rem] font-bold">Ready in three steps</h2>
                <ol className="mt-10 grid list-none gap-10 p-0 md:grid-cols-3">
                    <li className="rounded-xl border-2 border-brand p-6 shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
                        <Users className="mx-auto mb-6 block h-16 w-16 text-[#D1003F]" aria-hidden="true" />
                        <div className="flex items-center gap-6">
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#ccc9f7] text-[2.75rem] text-brand">
                                1
                            </span>
                            <h3 className="text-[1.7rem] text-[#7A2E0E]">Create a room</h3>
                        </div>
                        <p className="mt-8 text-[1.35rem]">
                            The teacher picks an activity and gets a room code.
                        </p>
                    </li>
                    <li className="rounded-xl border-2 border-brand p-6 shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
                        <Ticket className="mx-auto mb-6 block h-16 w-16 text-[#D1003F]" aria-hidden="true" />
                        <div className="flex items-center gap-6">
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#ccc9f7] text-[2.75rem] text-brand">
                                2
                            </span>
                            <h3 className="text-[1.7rem] text-[#7A2E0E]">Join with the code</h3>
                        </div>
                        <p className="mt-8 text-[1.35rem]">
                            Students type the code and join the room.
                        </p>
                    </li>
                    <li className="rounded-xl border-2 border-brand p-6 shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
                        <CodeXml className="mx-auto mb-6 block h-16 w-16 text-[#D1003F]" aria-hidden="true" />
                        <div className="flex items-center gap-6">
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#ccc9f7] text-[2.75rem] text-brand">
                                3
                            </span>
                            <h3 className="text-[1.7rem] text-[#7A2E0E]">Code, run, get help</h3>
                        </div>
                        <p className="mt-8 text-[1.35rem]">
                            Students write their code, test it, and can get feedback from the teacher when they are stuck.
                        </p>
                    </li>
                </ol>
            </section>
        </div>

    )
}
