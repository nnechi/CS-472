import type { ReactNode } from 'react';
import './Features.css';

type Feature = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
};

const svgProps = {
  width: 36,
  height: 36,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const FEATURES: Feature[] = [
  {
    id: "screen-sharing",
    title: "Live Screen Sharing Room",
    description:
      "Teachers create a room where students work on programming questions and share their screens with the teacher.",
    icon: (
      <svg {...svgProps}>
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M8 20h8M12 16v4" />
        <path d="M12 13V8m0 0-2.5 2.5M12 8l2.5 2.5" />
      </svg>
    ),
  },
  {
    id: "teacher-editing",
    title: "Teacher Editing Mode",
    description:
      "Teachers can directly edit student code and provide immediate feedback.",
    icon: (
      <svg {...svgProps}>
        <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" />
        <path d="M14 7l3 3" />
      </svg>
    ),
  },
  {
    id: "run-button",
    title: "Run Button",
    description:
      "Built-in code execution test code instantly without needing an external Integrated Development Environment.",
    icon: (
      <svg {...svgProps}>
        <rect x="2.5" y="4" width="19" height="16" rx="2" />
        <path d="M7 10l3 2.5L7 15M12.5 15H17" />
      </svg>
    ),
  },
  {
    id: "timer",
    title: "Built-in Timer",
    description:
      "Teachers can set a timer for each question to ensure that the class does not linger on the same programming challenge for too long.",
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9.5 2.5h5" />
      </svg>
    ),
  },
];

function FeatureCard({ title, description, icon }: Feature) {
  return (
    <article className="features-card">
      <div className="features-card__header">
        <span className="features-card__icon">{icon}</span>
        <h3 className="text-5xl font-bold features-card__title">{title}</h3>
      </div>
      <p className="features-card__text">{description}</p>
    </article>
  );
}

  export default function Features() {
  return (
    <main className="features-page">
        <h1 className="features-page__header">Features</h1>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <FeatureCard key={f.id} {...f} />
          ))}
        </div>
    </main>
  );
}