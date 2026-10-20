export default function AboutUs() {
    return (
        <main>
        <section className="w-full bg-[#f5f4fc] px-6 py-20 sm:px-12">
            <div className="mx-auto max-w-6xl">
            <h1 className="text-4xl font-bold text-black sm:text-5xl">
                        Why CS Education Needs a Better Tool
                    </h1>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
                <article className = "rounded-xl bg-[#ccc9f7] p-8">
                    <h2 className="text-xl font-bold text-[#7A2E0E]">
                        Lack of engagement in content
                                </h2>
                    <p className = "mt-6 text-black">
                        Programming individually and quietly in class can
                        cause students to become disinterested.
                    </p>
                </article>

                <article className="rounded-xl bg-[#ccc9f7] p-8">
                    <h2 className="text-xl font-bold text-[#7A2E0E]">
                        Slow Feedback Loop
                    </h2>
                    <p className="mt-6 text-black">
                        The process of students modifying code and showing
                        it again is slow and inefficient.
                    </p>
                </article>

                <article className="rounded-xl bg-[#ccc9f7] p-8"> 
                    <h2 className="text-xl font-bold text-[#7A2E0E]">
                        Limited Interaction in Lectures
                     </h2>
                           
                    <p className="mt-6 text-black">
                        Providing real-time coding feedback is difficult
                        in large lecture environments.
                    </p>
                </article>
                
            </div>
            </div>
        </section>
        </main>
    );
}