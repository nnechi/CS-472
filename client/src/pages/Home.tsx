// Sections, top to bottom:
//   1. HERO          title, a room code box for students, a sign-up link for teachers, the coding room picture
//   2. HOW IT WORKS  id="how"       three numbered steps
//   3. ABOUT US      id="about"     the three problems we solve
//   4. FEATURES      id="features"  what teachers get and what students get, side by side
//   5. GET STARTED   navy band: the same two ways in as the hero
// The footer is in components/Footer.tsx.
import { FormEvent, ReactNode, useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Hand, Hourglass, MessageSquareOff, PawPrint, Play, Ticket, UserX } from "lucide-react"
import codingRoomPic from "../assets/home/example.png"
import PupAvatar from "../components/chat/PupAvatar"
import { ROOM_CODE_MAX_LENGTH, normalizeRoomCode } from "../utils/roomCode"

// Makes a colored band stretch the full width of the screen, even though the
// page sits inside the layout's centered column.
const FULL_WIDTH = "mx-[calc(50%-50vw)]"
// Keeps the content of every band in the same centered column.
const COLUMN = "mx-auto w-full max-w-screen-2xl px-6 sm:px-12 lg:px-16"

const LABEL = "w-fit rounded-full bg-brand px-4 py-1.5 text-base font-bold uppercase tracking-widest text-white"
const OUTLINE_PILL = "inline-flex w-fit items-center gap-2.5 rounded-full border-2 border-brand bg-white px-5 py-2.5 text-xl font-bold"

function FeatureIcon({ children }: { children: ReactNode }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {children}
        </svg>
    )
}

function SectionHead({ kicker, title, text }: { kicker: string; title?: string; text?: string }) {
    return (
        <div className={`${title ? "mb-12" : "mb-8"} flex flex-col gap-2`}>
            <span className={`${LABEL} ${title ? "mb-2" : ""}`}>{kicker}</span>
            {title && <h2 className="text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-tight text-balance lg:whitespace-nowrap">{title}</h2>}
            {text && <p className="max-w-3xl text-lg text-brand/70">{text}</p>}
        </div>
    )
}

function RoomCodeForm({ code, onChange, onSubmit, id }: { code: string; onChange: (value: string) => void; onSubmit: (e: FormEvent) => void; id: string }) {
    return (
        <form
            onSubmit={onSubmit}
            noValidate
            className="flex w-full max-w-md items-center gap-1.5 rounded-full border-2 border-brand bg-white p-1.5 focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-brand/40"
        >
            <label htmlFor={id} className="sr-only">Room code</label>
            <input
                id={id}
                value={code}
                onChange={(e) => onChange(e.target.value)}
                maxLength={ROOM_CODE_MAX_LENGTH}
                autoComplete="off"
                placeholder="Enter room code"
                className="h-12 min-w-0 flex-1 bg-transparent px-4 text-lg uppercase tracking-[0.12em] text-brand placeholder:normal-case placeholder:tracking-normal placeholder:text-brand/50 focus:outline-none"
            />
            <button type="submit" className="h-12 cursor-pointer rounded-full bg-green-700 px-7 font-bold text-white shadow-sm transition-colors hover:bg-green-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-green-700">
                Join
            </button>
        </form>
    )
}

// ---- Content. Edit the words here. ----

const STEPS = [
    { title: "Create a room", text: "The teacher picks an activity and gets a room code." },
    { title: "Join with the code", text: "Students type the code and join the room." },
    { title: "Code, run, get help", text: "Students write their code, test it, and can get feedback from the teacher when they are stuck." },
]

const WHY = [
    {
        icon: <UserX className="h-6 w-6" aria-hidden="true" />,
        title: "Lack of engagement",
        problem: "Programming alone and in silence makes it easy for students to tune out and lose interest.",
        help: "Students code together in a live room with their class, chat as they work, and race the same timer, so practice feels like a shared activity.",
    },
    {
        icon: <Hourglass className="h-6 w-6" aria-hidden="true" />,
        title: "Slow feedback loop",
        problem: "Changing code and showing it to the teacher again is slow and inefficient, so mistakes sit unnoticed.",
        help: "Teachers see each student's code as it's written and can edit it directly, and the built-in Run button shows results right away.",
    },
    {
        icon: <MessageSquareOff className="h-6 w-6" aria-hidden="true" />,
        title: "Limited interaction",
        problem: "Providing real time coding feedback is difficult in large lecture environments.",
        help: "Raised hands line up in order and private chats let every student get help, even the ones who would never speak up in a lecture hall.",
    },
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

const STUDENT_FEATURES = [
    { title: "Join with a code", text: "No account needed. Type the room code and you're in.", icon: <Ticket className="h-6 w-6" aria-hidden="true" /> },
    { title: "Pick your pup", text: "Choose a pup avatar so your teacher and class know it's you.", icon: <PawPrint className="h-6 w-6" aria-hidden="true" /> },
    { title: "Run your code", text: "See your output right away, right in the browser.", icon: <Play className="h-6 w-6" aria-hidden="true" /> },
    { title: "Ask for help", text: "Raise your hand or chat with the teacher without leaving your seat.", icon: <Hand className="h-6 w-6" aria-hidden="true" /> },
]

const AUDIENCES = [
    { label: "For teachers", title: "See every student's code at once", items: FEATURES },
    { label: "For students", title: "Join with a code, pick your pup", items: STUDENT_FEATURES },
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
        // -my-12 cancels the layout's top and bottom padding, so the first band
        // touches the navbar and the last band touches the footer.
        <div className="-my-12">

            <section id="top" className={`${FULL_WIDTH} bg-brand-light/50 pb-16 pt-16 text-brand lg:pt-20`}>
                <div className={COLUMN}>
                    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end">
                        <div>
                            <h1 className="text-[clamp(2.4rem,5.4vw,4.4rem)] font-bold leading-[1.05] text-balance">
                                Programming Practice Made Fun
                            </h1>
                            <p className="mt-5 max-w-[46ch] text-[clamp(1.1rem,1.6vw,1.3rem)] text-brand/75">
                                A new way for students to practice programming in class with real-time feedback.
                            </p>
                        </div>
                        <div className="flex flex-col gap-6 lg:pb-1">
                            <div className="flex flex-col gap-2.5">
                                <p className="font-semibold">Students: join your class</p>
                                <RoomCodeForm id="homeRoomCode" code={code} onChange={setCode} onSubmit={handleJoin} />
                            </div>
                            <p className="text-brand/80">
                                Teaching a class?{" "}
                                <Link to="/signup" className="font-semibold text-brand underline underline-offset-4 hover:no-underline">
                                    Create a teacher account
                                </Link>
                            </p>
                        </div>
                    </div>

                    <figure className="m-0 mt-12 overflow-hidden rounded-2xl border-2 border-brand bg-white">
                        <figcaption className="border-b-2 border-brand bg-brand-light px-4 py-2.5 text-sm font-bold">Coding room</figcaption>
                        <img src={codingRoomPic} alt="A LittlePointers room: the question and correct output on the left, the code editor with a Run button and the student's output on the right" className="block h-auto w-full" />
                    </figure>
                </div>
            </section>

            <section id="how" className={`${FULL_WIDTH} scroll-mt-6 py-24`}>
                <div className={COLUMN}>
                    <SectionHead kicker="How it works" />
                    <ol className="m-0 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-8">
                        {STEPS.map((step, i) => (
                            <li key={step.title} className="relative flex flex-col gap-3">
                                <div className="flex items-center gap-4">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-white text-lg font-bold">{i + 1}</span>
                                    {i < STEPS.length - 1 && <span className="hidden h-0.5 flex-1 bg-brand/25 md:block" aria-hidden="true" />}
                                </div>
                                <h3 className="mt-2 text-[1.5rem] font-bold">{step.title}</h3>
                                <p className="max-w-[38ch] text-lg text-brand/70">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section id="about" className={`${FULL_WIDTH} scroll-mt-6 bg-brand-light/50 py-24`}>
                <div className={COLUMN}>
                    <SectionHead kicker="About us" title="We Solve The Problems Holding CS Classes Back" />
                    <div className="grid gap-10 md:grid-cols-3 md:grid-rows-[auto_auto_auto] md:gap-x-8 md:gap-y-5">
                        {WHY.map((item) => (
                            <article key={item.title} className="flex flex-col gap-4 md:row-span-3 md:grid md:grid-rows-subgrid">
                                <h3 className={OUTLINE_PILL}>
                                    {item.icon}
                                    {item.title}
                                </h3>
                                <p className="max-w-[42ch] text-lg text-brand/80">{item.problem}</p>
                                <div className="flex max-w-[42ch] flex-col gap-1 self-start border-l-4 border-green-700 pl-4">
                                    <p className="font-bold text-green-800">How LittlePointers helps</p>
                                    <p className="text-lg text-brand/80">{item.help}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section id="features" className={`${FULL_WIDTH} scroll-mt-6 py-24`}>
                <div className={COLUMN}>
                    <SectionHead kicker="Features" title="LittlePointers tools for live coding" />
                    <div className="grid gap-8 md:grid-cols-2 md:grid-rows-[repeat(6,auto)] md:gap-y-0">
                        {AUDIENCES.map((audience) => (
                            <article key={audience.label} className="flex flex-col rounded-2xl border border-brand/20 bg-white p-8 md:row-span-6 md:grid md:grid-rows-subgrid">
                                <span className={OUTLINE_PILL}>{audience.label}</span>
                                <h3 className="mb-2 mt-4 text-[1.6rem] font-bold leading-tight">
                                    {audience.title}
                                </h3>
                                <ul role="list" className="contents">
                                    {audience.items.map((item) => (
                                        <li key={item.title} className="flex gap-4 border-t border-brand/15 py-5 last:pb-0">
                                            <span className="mt-0.5 shrink-0 text-brand">{item.icon}</span>
                                            <div className="flex flex-col gap-1">
                                                <h4 className="flex items-center gap-3 text-xl font-bold">
                                                    {item.title}
                                                    {item.title === "Pick your pup" && (
                                                        <span className="flex -space-x-2" aria-hidden="true">
                                                            <PupAvatar pup="corgi" size={28} />
                                                            <PupAvatar pup="shiba" size={28} />
                                                            <PupAvatar pup="beagle" size={28} />
                                                        </span>
                                                    )}
                                                </h4>
                                                <p className="text-lg text-brand/70">{item.text}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className={`${FULL_WIDTH} bg-brand py-20 text-white`}>
                <div className={`${COLUMN} flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between`}>
                    <h2 className="text-[clamp(1.8rem,3.2vw,2.6rem)] font-bold leading-tight text-balance">Bring live coding practice to your next class.</h2>
                    <div className="flex flex-wrap items-center gap-4">
                        <Link to="/signup" className="rounded-full bg-white px-6 py-3 font-bold text-brand hover:bg-white/90">
                            Create a teacher account
                        </Link>
                        <Link to="/joinroom" className="rounded-full border-2 border-green-700 bg-green-700 px-6 py-3 font-bold text-white transition-colors hover:border-green-800 hover:bg-green-800">
                            Join a room
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    )
}
