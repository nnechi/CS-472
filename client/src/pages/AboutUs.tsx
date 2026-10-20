function AlertIcon() {
    return (
        <svg
            className="h-8 w-8 shrink-0 text-[#161616]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="15.5" x2="12.01" y2="15.5" />
        </svg>
    );
}

export default function AboutUs() {
    return (
        <main>
            <section className="w-full px-6 py-20 sm:px-12"> 
                 <div className="mx-auto max-w-6xl">
                     <h1 className="text-4xl font-bold text-black sm:text-5xl">
                        Why CS Education Needs a Better Tool
                     </h1>

                     <div className="mt-12 grid gap-8 md:grid-cols-3">
                        <article className = "rounded-xl bg-[#ccc9f7] p-8">
                          <div className="flex items-center gap-3">
                             <AlertIcon />
                             <h2 className="text-xl font-bold text-[#7A2E0E]">
                                 Lack of engagement in content
                             </h2>
                           </div>
                         <p className = "mt-6 text-black">
                              Programming individually and quietly in class can
                              cause students to become disinterested.
                         </p>
                       </article>

                        <article className = "rounded-xl bg-[#ccc9f7] p-8">
                          <div className="flex items-center gap-3">
                             <AlertIcon />
                             <h2 className="text-xl font-bold text-[#7A2E0E]">
                                 Slow Feedback Loop
                             </h2>
                           </div>
                         <p className = "mt-6 text-black">
                              The process of students modifying code and showing
                              it again is slow and inefficient.
                         </p>
                       </article>
                       

                        <article className = "rounded-xl bg-[#ccc9f7] p-8">
                          <div className="flex items-center gap-3">
                             <AlertIcon />
                             <h2 className="text-xl font-bold text-[#7A2E0E]">
                                 Limited Interaction in Lectures
                             </h2>
                           </div>
                         <p className = "mt-6 text-black">
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