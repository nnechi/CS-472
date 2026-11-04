import { useEffect, useState } from "react";

// Pup avatars for students in the chat. 
import beagle from "../../assets/pups/beagle.png";
import chihuahua from "../../assets/pups/chihuahua.png";
import collie from "../../assets/pups/collie.png";
import corgi from "../../assets/pups/corgi.png";
import dachshund from "../../assets/pups/dachshund.png";
import frenchie from "../../assets/pups/frenchie.png";
import golden from "../../assets/pups/golden.png";
import jindo from "../../assets/pups/jindo.png";
import maltese from "../../assets/pups/maltese.png";
import pomeranian from "../../assets/pups/pomeranian.png";
import poodle from "../../assets/pups/poodle.png";
import shiba from "../../assets/pups/shiba.png";

export type PupId =
  | "golden"
  | "frenchie"
  | "poodle"
  | "shiba"
  | "corgi"
  | "collie"
  | "dachshund"
  | "maltese"
  | "pomeranian"
  | "chihuahua"
  | "beagle"
  | "jindo";

interface Pup {
  label: string;
  src: string; // the breed's picture
  bg: string; // circle behind the picture
}

export const PUPS: Record<PupId, Pup> = {
  golden: { label: "Golden", src: golden, bg: "#E4E0F5" },
  frenchie: { label: "Frenchie", src: frenchie, bg: "#EDE6DA" },
  poodle: { label: "Poodle", src: poodle, bg: "#F9D3DE" },
  shiba: { label: "Shiba", src: shiba, bg: "#D9EED8" },
  corgi: { label: "Corgi", src: corgi, bg: "#CDE6EA" },
  collie: { label: "Collie", src: collie, bg: "#F8E1C8" },
  dachshund: { label: "Dachshund", src: dachshund, bg: "#D9EED8" },
  maltese: { label: "Maltese", src: maltese, bg: "#F9D3DE" },
  pomeranian: { label: "Pomeranian", src: pomeranian, bg: "#F8E1C8" },
  chihuahua: { label: "Chihuahua", src: chihuahua, bg: "#E4E0F5" },
  beagle: { label: "Beagle", src: beagle, bg: "#F8E1C8" },
  jindo: { label: "Jindo", src: jindo, bg: "#CDE6EA" },
};

export const PUP_IDS = Object.keys(PUPS) as PupId[];

// True when a value (for example one sent by another browser) is a known pup.
export function isPupId(value: unknown): value is PupId {
  return typeof value === "string" && value in PUPS;
}

export function randomPupId(except?: PupId): PupId {
  const choices = PUP_IDS.filter((id) => id !== except);
  return choices[Math.floor(Math.random() * choices.length)];
}

// The student's pup is remembered on this browser. Storage can be blocked
// (private mode), so every read and write is allowed to fail.
const STORAGE_KEY = "littlepointers.pup";

// The saved pup, or a new random one (saved for next time) on a first visit.
export function loadPupId(): PupId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isPupId(saved)) return saved;
  } catch {
    // Storage unavailable: fall through to a random pup.
  }
  const pup = randomPupId();
  savePupId(pup);
  return pup;
}

export function savePupId(pup: PupId): void {
  try {
    localStorage.setItem(STORAGE_KEY, pup);
  } catch {
    // Storage unavailable: the pup still works until the page reloads.
  }
}

interface PupAvatarProps {
  pup: PupId;
  // Width and height in px.
  size?: number;
}

// A round pup picture on a soft colored circle. The breed name is its label.
export default function PupAvatar({ pup, size = 36 }: PupAvatarProps) {
  const p = PUPS[pup] ?? PUPS.corgi;

  return (
    <span
      className="inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: p.bg }}
    >
      <img
        src={p.src}
        alt={p.label}
        width={size}
        height={size}
        className="h-[92%] w-[92%] object-contain"
        draggable={false}
      />
    </span>
  );
}

interface PupPickerProps {
  // The student's name, shown in the preview ("Jun as a Husky").
  name: string;
  current: PupId;
  onSave: (pup: PupId) => void;
  onClose: () => void;
}

// "Choose your pup": a grid of breeds, a preview, Surprise me, and Save pup.
// Nothing changes until the student presses Save pup.
export function PupPicker({ name, current, onSave, onClose }: PupPickerProps) {
  const [picked, setPicked] = useState<PupId>(current);

  // Escape closes the picker without saving.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col gap-3 overflow-y-auto bg-white p-4 text-brand"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pup-picker-title"
    >
      <div className="flex items-center justify-between">
        <h2 id="pup-picker-title" className="m-0 text-lg font-bold">
          Choose Your Pup 
        </h2>
        <button
          type="button"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-brand-light/40"
          onClick={onClose}
          aria-label="Close without saving"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-brand-light/30 p-3">
        <PupAvatar pup={picked} size={54} />
        <div className="flex flex-col gap-1">
          <span className="font-bold">
            {name} as a {PUPS[picked].label}
          </span>
          <span className="text-sm text-brand/200 whitespace-nowrap">
            Your pup appears next to your messages.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PUP_IDS.map((id) => {
          const selected = id === picked;
          return (
            <button
              key={id}
              type="button"
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-xs font-semibold ${
                selected
                  ? "border-2 border-brand bg-brand-light/30"
                  : "border border-brand/15 bg-white hover:bg-brand-light/20"
              }`}
              onClick={() => setPicked(id)}
              aria-pressed={selected}
            >
              <PupAvatar pup={id} size={40} />
              {PUPS[id].label}
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-brand bg-white text-sm font-semibold hover:bg-brand-light/30"
          onClick={() => setPicked(randomPupId(picked))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 3h5v5" />
            <path d="M4 20L21 3" />
            <path d="M21 16v5h-5" />
            <path d="M15 15l6 6" />
            <path d="M4 4l5 5" />
          </svg>
          Shuffle
        </button>
        <button
          type="button"
          className="h-11 flex-1 cursor-pointer rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand/90"
          onClick={() => onSave(picked)}
        >
          Save pup
        </button>
      </div>
    </div>
  );
}
