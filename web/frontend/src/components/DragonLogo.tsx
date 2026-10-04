import { useId } from "react";

// Dragón de la marca DarkN (mismos trazos que remote.darkn-47.com).

/** id seguro para <defs>: si dos SVG comparten id y uno está oculto, el gradiente no pinta. */
function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Marca de línea (header / sidebar). Usa currentColor. */
export function DragonLogo({ size = 40, glow = true, className = "text-dragon-400" }: { size?: number; glow?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
      style={glow ? { filter: "drop-shadow(0 0 10px rgb(231 45 61 / 0.45))" } : undefined}
    >
      <path
        d="M35.5 5 27 9.5 31 13 22.5 15 16 9 10 14l5 8-6 4 3.5 6.5L7 40l13-5 8-9.5 8-3-5-4 10-6-7 1.5L35.5 5Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="m18 28 6 1.5-4 5.5M28 16l4.5 2M35 13l-3.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Dragón grande con alas (login / héroe). */
export function DragonHero({ className = "" }: { className?: string }) {
  const body = useSvgId("dragon-red");
  const wing = useSvgId("wing-red");
  return (
    <svg viewBox="0 0 560 560" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={body} x1="84" y1="520" x2="470" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7d1018" />
          <stop offset=".42" stopColor="#eb293a" />
          <stop offset="1" stopColor="#ff7581" />
        </linearGradient>
        <linearGradient id={wing} x1="97" y1="166" x2="394" y2="392" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f23b4a" />
          <stop offset="1" stopColor="#5f0b15" />
        </linearGradient>
      </defs>
      <path
        d="M458 82c-40-17-89-17-124 5l-24 25 40-7-27 30 46-9-16 25c-50 4-94 25-120 65l-34 57c-26 45-43 92-78 118-29 21-66 24-97 12 32 34 89 46 133 24 42-20 65-60 80-101 16-43 42-78 78-98 22-12 43-15 71-15l-25-30 42 7-20-27 43-4-14-16 42-7-26-19 32-7-25-17 23-11Z"
        fill={`url(#${body})`}
      />
      <path d="M292 202c-26-59-94-93-169-95l37 32-64 9 45 21-62 31 67 2-52 45 91-25 46 52 61-72Z" fill={`url(#${wing})`} />
      <path
        d="m255 215-93-65 58 20-37-37 83 47M194 197l-65 19 46-36M205 269c-41 51-46 125-95 154 45-9 79-35 94-73l28-71"
        stroke="#ff9ba3"
        strokeOpacity=".64"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="m375 145 35 6-29 9" fill="#120b11" />
      <path d="m396 187 25 7-20 6" fill="#f7d2d5" />
      <path d="M281 279c-6 25-24 48-49 60l-36 13 24 11 49-10 39-36M323 257c-7 28-21 50-47 65l30 10 40-19 31-47" fill="#a81723" />
      <path d="m219 362-18 39 17-9 11 16 8-44M306 331l-4 43 14-12 14 14 6-45" fill="#ef4050" />
      <path d="M421 199c16 6 33 5 48-2l-20 20-31-1" fill="#7e101b" />
      <path d="m337 92 11-47 19 42M393 79l33-35-5 44" fill="#c02230" />
    </svg>
  );
}

/** Silueta para marcas de agua (currentColor). */
export function DragonWatermark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path fill="currentColor" d="M47 9 36 15l5 5-11 2-8-8-7 7 7 10-8 5 5 8-8 10 17-6 11-13 11-4-7-6 14-8-10 1-4-9Z" />
    </svg>
  );
}
