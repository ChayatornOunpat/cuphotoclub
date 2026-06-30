// Dark camera-icon placeholder shown in the editor when no image URL is set.
// High contrast: near-black background (#0c0c0a) with white icon at low opacity.
const _svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9">
  <rect width="16" height="9" fill="#0c0c0a"/>
  <g opacity=".28" fill="none" stroke="#f5f4f0" stroke-width=".4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5.4" y="2.8" width="5.2" height="3.8" rx=".4"/>
    <circle cx="8" cy="4.7" r="1.15"/>
    <path d="M7.1 2.8V2.3a.28.28 0 0 1 .28-.28h1.24a.28.28 0 0 1 .28.28v.5"/>
    <line x1="10" y1="3.3" x2="10.5" y2="3.3"/>
  </g>
</svg>`

export const PLACEHOLDER_IMG = `data:image/svg+xml,${encodeURIComponent(_svg)}`
