// Sections, top to bottom:
//   1. HERO          navy band: title, room code box, two demo pictures
//   2. HOW IT WORKS  id="how"       three step cards
//   3. FEATURES      id="features"  four feature cards (mint band)
//   4. ABOUT US      id="about"     three "why" cards
//   5. FOR TEACHERS / FOR STUDENTS   two cards (mint band)
// The footer is in components/Footer.tsx.
import { FormEvent, ReactNode, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CodeXml, Ticket, Users } from "lucide-react"
import codingRoomPic from "../assets/home/example.png"
import waitingRoomPic from "../assets/home/waiting-room.png"
import PupAvatar from "../components/chat/PupAvatar"
import { ROOM_CODE_MAX_LENGTH, normalizeRoomCode } from "../utils/roomCode"

// Makes a colored band stretch the full width of the screen, even though the
// page sits inside the layout's centered column.
const FULL_WIDTH = "mx-[calc(50%-50vw)]"
// Keeps the content of every band in the same centered column.
const COLUMN = "mx-auto w-full max-w-6xl px-6 sm:px-12"

// One icon style for the Features and About cards (same as the Features page).
function FeatureIcon({ children }: { children: ReactNode }) {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {children}
        </svg>
    )
}

// The small red title above each section heading ("HOW IT WORKS").
function SectionHead({ kicker, title, text }: { kicker: string; title: string; text: string }) {
    return (
        <div className="mb-10 flex max-w-3xl flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-widest text-[#D1003F]">{kicker}</span>
            <h2 className="text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-tight text-balance">{title}</h2>
            <p className="text-lg text-brand/70">{text}</p>
        </div>
    )
}

// ---- Content. Edit the words here. ----

const STEPS = [
    { icon: <Users className="h-7 w-7" aria-hidden="true" />, title: "Create a room", text: "The teacher picks an activity and gets a room code." },
    { icon: <Ticket className="h-7 w-7" aria-hidden="true" />, title: "Join with the code", text: "Students type the code and join the room." },
    { icon: <CodeXml className="h-7 w-7" aria-hidden="true" />, title: "Code, run, get help", text: "Students write their code, test it, and can get feedback from the teacher when they are stuck." },
]

const FEATURES = [
    {
        title: "Live screen sharing room",
        text: "Students work on programming questions and share their screens with the teacher.",
        icon: <FeatureIcon><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /><path d="M12 13V8m0 0-2.5 2.5M12 8l2.5 2.5" /></FeatureIcon>,
    },
    {
        title: "Teacher editing mode",
        text: "Teachers can edit a student's code directly and give feedback right away.",
        icon: <FeatureIcon><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" /><path d="M14 7l3 3" /></FeatureIcon>,
    },
    {
        title: "Run button",
        text: "Built-in code execution. Test code instantly without an external IDE.",
        icon: <FeatureIcon><rect x="2.5" y="4" width="19" height="16" rx="2" /><path d="M7 10l3 2.5L7 15M12.5 15H17" /></FeatureIcon>,
    },
    {
        title: "Built-in timer",
        text: "Set a timer for each question so the class keeps moving.",
        icon: <FeatureIcon><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9.5 2.5h5" /></FeatureIcon>,
    },
]

const alertIcon = <FeatureIcon><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M12 8v4" /><path d="M12 16h.01" /></FeatureIcon>

const WHY = [
    { title: "Lack of engagement", text: "Programming alone and in silence can make students lose interest." },
    { title: "Slow feedback loop", text: "Changing code and showing it to the teacher again is slow and inefficient." },
    { title: "Limited interaction", text: "Real-time coding feedback is hard to give in a large lecture hall." },
]

export default function Home() {
    const navigate = useNavigate()
    const [code, setCode] = useState("")

    // When the address is /#features, /#about or /#how, scroll smoothly to that
    // section. "key" makes a second click on the same menu link scroll again.
    const { hash, key } = useLocation()
    useEffect(() => {
        if (!hash) return
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" })
    }, [hash, key])

    const handleJoin = (e: FormEvent) => {
        e.preventDefault()
        const roomCode = normalizeRoomCode(code)
        navigate(roomCode ? `/joinroom?code=${roomCode}` : "/joinroom")
    }

    return (
        // -my-12 cancels the layout's top and bottom padding, so the navy band
        // touches the navbar and the last band touches the footer.
        <div className="-my-12">

            {/* ===== 1. HERO ===== */}
            <section
                id="top"
                className={`${FULL_WIDTH} bg-brand-light/50 pt-16 text-brand`} 
            >
                <div className={`${COLUMN} flex flex-col items-center text-center`}>
                    <span className="rounded-full bg-white/70 px-4 py-1.5 text-sm tracking-wide text-brand">
                        For CS classrooms · live coding practice
                    </span>
                    <h1 className="mt-5 text-[clamp(2.4rem,6.2vw,4.8rem)] font-bold leading-[1.05] text-balance lg:whitespace-nowrap">
                        Programming Practice Made Fun
                    </h1>
                    <p className="mt-4 max-w-[46ch] text-[clamp(1.05rem,1.6vw,1.3rem)] text-brand/75">
                        A new way for students to practice programming in class with real-time feedback.
                    </p>

                    {/* Room code box */}
                    <form
                        onSubmit={handleJoin}
                        noValidate
                        className="mt-8 flex w-full max-w-md items-center gap-1.5 rounded-full bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-[#e28413]"
                    >
                        <label htmlFor="homeRoomCode" className="sr-only">Room code</label>
                        <input
                            id="homeRoomCode"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            maxLength={ROOM_CODE_MAX_LENGTH}
                            autoComplete="off"
                            placeholder="Enter room code"
                            className="h-12 min-w-0 flex-1 bg-transparent px-4 text-lg uppercase tracking-[0.12em] text-brand placeholder:normal-case placeholder:tracking-normal placeholder:text-brand/50 focus:outline-none"
                        />
                        <button type="submit" className="h-12 cursor-pointer rounded-full bg-[#b45309] px-6 font-bold text-white bg-brand hover:bg-brand/90">
                            Join
                        </button>
                    </form>

                    {/* Two demo pictures side by side (stacked on phones).
                        They hang over the bottom of the navy band. */}
                    <div className="relative -mb-36 mt-12 grid w-full gap-5 md:grid-cols-[2.3fr_1fr]">
                        <figure className="m-0 flex min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-brand bg-white shadow-[0_24px_60px_rgba(23,14,82,0.45)]">
                            <figcaption className="border-b border-brand bg-brand-light px-4 py-2.5 text-left text-sm font-bold text-brand">Coding room</figcaption>
                            <div className="flex flex-1 items-center bg-white">
                                <img src={codingRoomPic} alt="A LittlePointers room: the question and correct output on the left, the code editor with a Run button and the student's output on the right" className="block h-auto w-full" />
                            </div>
                        </figure>
                        <figure className="m-0 flex min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-brand bg-white shadow-[0_24px_60px_rgba(23,14,82,0.45)]">
                            <figcaption className="border-b border-brand bg-brand-light px-4 py-2.5 text-left text-sm font-bold text-brand">Waiting room</figcaption>
                            <div className="flex flex-1 items-center justify-center bg-paper p-4">
                                <img src={waitingRoomPic} alt="The waiting screen: Waiting for your teacher, the student's pup, and the room code" className="block h-auto w-full max-w-[260px]" />
                            </div>
                        </figure>
                    </div>
                </div>
            </section>

            {/* ===== 2. HOW IT WORKS ===== */}
            {/* pt-56 leaves room for the demo pictures hanging down from the hero. */}
            <section id="how" className={`${FULL_WIDTH} scroll-mt-6 pb-24 pt-56`}>
                <div className={COLUMN}>
                    <SectionHead kicker="How it works" title="Ready in three steps" text="Students join with a code. Nothing to install." />
                    <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
                        {STEPS.map((step) => (
                            <li key={step.title} className="flex flex-col gap-3.5 rounded-2xl border-2 border-brand bg-white p-6">
                                <span className="flex h-13 w-13 items-center justify-center rounded-xl bg-pop/40 text-[#D1003F]">{step.icon}</span>
                                <h3 className="text-[1.35rem] font-bold text-[#7A2E0E]">{step.title}</h3>
                                <p className="text-brand/70">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* ===== 3. ABOUT US ===== */}
            <section id="about" className={`${FULL_WIDTH} scroll-mt-6 bg-brand-light/30 py-24`}> 
                <div className={COLUMN}>
                    <SectionHead kicker="About us" title="Why CS education needs a better tool" text="We are a student team building the tool we wanted in our own intro programming classes." />
                    <div className="grid gap-5 md:grid-cols-3">
                        {WHY.map((item) => (
                            <article key={item.title} className="flex flex-col gap-3 rounded-2xl border border-brand/20 bg-white p-6">
                                <span className="flex h-13 w-13 items-center justify-center rounded-xl bg-warn/40 text-[#D1003F]">{alertIcon}</span>
                                <h3 className="text-[1.35rem] font-bold text-[#7A2E0E]">{item.title}</h3>
                                <p className="text-brand/70">{item.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== 4. FEATURES ===== */}
            <section id="features" className={`${FULL_WIDTH} scroll-mt-6 py-24`}> 
                <div className={COLUMN}>
                    <SectionHead kicker="Features" title="LittlePointers tools for live coding" text="Everything a teacher needs to run a coding lab from one screen." />
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {FEATURES.map((feature) => (
                            <article key={feature.title} className="flex flex-col gap-3 rounded-2xl bg-pop p-6 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                                <span className="flex h-13 w-13 items-center justify-center rounded-xl bg-white text-[#D1003F]">{feature.icon}</span>
                                <h3 className="text-[1.35rem] font-bold text-[#7A2E0E]">{feature.title}</h3>
                                <p className="text-brand/75">{feature.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== 5. FOR TEACHERS / FOR STUDENTS ===== */}
            <section className={`${FULL_WIDTH} bg-brand-light/30 py-24`}>
                <div className={`${COLUMN} grid gap-5 md:grid-cols-2`}>
                    <div className="flex flex-col gap-3.5 rounded-3xl bg-pop p-8">
                        <span className="text-sm font-bold uppercase tracking-widest text-[#800020]">For teachers</span>
                        <h3 className="text-[1.7rem] font-bold">See every student's code at once</h3>
                        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-brand/75">
                            <li>Create a room from an activity in seconds</li>
                            <li>Answer raised hands in order</li>
                            <li>Jump into a student's code to help</li>
                        </ul>
                    </div>
                    <div className="flex flex-col gap-3.5 rounded-3xl bg-brand-light p-8">
                        <span className="text-sm font-bold uppercase tracking-widest text-[#800020]">For students</span>
                        <h3 className="text-[1.7rem] font-bold">Join with a code, pick your pup</h3>
                        <div className="flex -space-x-2.5" aria-hidden="true">
                            <PupAvatar pup="corgi" size={44} />
                            <PupAvatar pup="shiba" size={44} />
                            <PupAvatar pup="beagle" size={44} />
                        </div>
                        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-brand/75">
                            <li>No account needed to join</li>
                            <li>Run your code and see the output</li>
                            <li>Ask for help without leaving your seat</li>
                        </ul>
                    </div>
                </div>
            </section>
        </div>
    )
}