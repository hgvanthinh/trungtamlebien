// src/pages/public/BombGame/svgAssets.js
// ─── SVG Assets & Utilities ────────────────────────────────────

export const SVG = {
    floor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#1a1a2e"/>
      <rect x="0" y="0" width="16" height="16" fill="#1e1e38" opacity=".5"/>
      <rect x="16" y="16" width="16" height="16" fill="#1e1e38" opacity=".5"/>
    </svg>`,
    wall: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#374151"/>
      <rect x="1" y="1" width="30" height="30" fill="#4b5563"/>
      <rect x="2" y="2" width="28" height="5" fill="#6b7280" rx="1"/>
      <rect x="2" y="10" width="12" height="5" fill="#6b7280" rx="1"/>
      <rect x="18" y="10" width="12" height="5" fill="#6b7280" rx="1"/>
      <rect x="2" y="18" width="28" height="5" fill="#6b7280" rx="1"/>
      <rect x="2" y="26" width="12" height="4" fill="#6b7280" rx="1"/>
      <rect x="18" y="26" width="12" height="4" fill="#6b7280" rx="1"/>
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="#1f2937" stroke-width="1"/>
    </svg>`,
    block: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#92400e"/>
      <rect x="1" y="1" width="30" height="30" fill="#b45309" rx="2"/>
      <rect x="2" y="2" width="28" height="28" fill="none" stroke="#78350f" stroke-width="2" rx="1"/>
      <line x1="16" y1="2" x2="16" y2="30" stroke="#78350f" stroke-width="1.5"/>
      <line x1="2" y1="16" x2="30" y2="16" stroke="#78350f" stroke-width="1.5"/>
      <line x1="2" y1="2" x2="30" y2="30" stroke="#78350f" stroke-width="1" opacity=".4"/>
      <line x1="30" y1="2" x2="2" y2="30" stroke="#78350f" stroke-width="1" opacity=".4"/>
      <rect x="2" y="2" width="28" height="3" fill="#d97706" opacity=".5" rx="1"/>
      <rect x="2" y="2" width="3" height="28" fill="#d97706" opacity=".5" rx="1"/>
    </svg>`,
    bomb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="18" r="11" fill="#111827"/>
      <circle cx="16" cy="18" r="11" fill="none" stroke="#374151" stroke-width="1.5"/>
      <ellipse cx="12" cy="13" rx="4" ry="3" fill="#1f2937" opacity=".6"/>
      <circle cx="13" cy="13" r="2" fill="white" opacity=".15"/>
      <line x1="16" y1="7" x2="20" y2="3" stroke="#78350f" stroke-width="2" stroke-linecap="round"/>
      <circle cx="21" cy="2" r="3" fill="#f97316"/>
      <circle cx="21" cy="2" r="1.5" fill="#fbbf24"/>
      <circle cx="21" cy="1" r="1" fill="white" opacity=".8"/>
    </svg>`,
    explosionCenter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M-1,1 h18 v14 h-18 z M1,-1 h14 v18 h-14 z"/><path fill="#facc15" d="M-1,3 h18 v10 h-18 z M3,-1 h10 v18 h-10 z"/><path fill="#ffffff" d="M-1,5 h18 v6 h-18 z M5,-1 h6 v18 h-6 z"/></svg>`,
    explosionH: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M-1,1 h18 v14 h-18 z"/><path fill="#facc15" d="M-1,3 h18 v10 h-18 z"/><path fill="#ffffff" d="M-1,5 h18 v6 h-18 z"/></svg>`,
    explosionV: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M1,-1 h14 v18 h-14 z"/><path fill="#facc15" d="M3,-1 h10 v18 h-10 z"/><path fill="#ffffff" d="M5,-1 h6 v18 h-6 z"/></svg>`,
    explosionEndL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M16,1 h-10 v2 h-2 v2 h-2 v6 h2 v2 h2 v2 h10 z"/><path fill="#facc15" d="M16,3 h-8 v2 h-2 v6 h2 v2 h8 z"/><path fill="#ffffff" d="M16,5 h-6 v6 h6 z"/></svg>`,
    explosionEndR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M0,1 h10 v2 h2 v2 h2 v6 h-2 v2 h-2 v2 h-10 z"/><path fill="#facc15" d="M0,3 h8 v2 h2 v6 h-2 v2 h-8 z"/><path fill="#ffffff" d="M0,5 h6 v6 h-6 z"/></svg>`,
    explosionEndU: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M1,16 v-10 h2 v-2 h2 v-2 h6 v2 h2 v2 h2 v10 z"/><path fill="#facc15" d="M3,16 v-8 h2 v-2 h6 v2 h2 v8 z"/><path fill="#ffffff" d="M5,16 v-6 h6 v6 z"/></svg>`,
    explosionEndD: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#dc2626" d="M1,0 v10 h2 v2 h2 v2 h6 v-2 h2 v-2 h2 v-10 z"/><path fill="#facc15" d="M3,0 v8 h2 v2 h6 v-2 h2 v-8 z"/><path fill="#ffffff" d="M5,0 v6 h6 v-6 z"/></svg>`,
    blockDebris: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="10" height="6" fill="#92400e" rx="1" transform="rotate(-15 7 5)"/>
      <rect x="3" y="3" width="8" height="4" fill="#b45309" rx="1" transform="rotate(-15 7 5)"/>
      <rect x="20" y="2" width="9" height="5" fill="#78350f" rx="1" transform="rotate(20 24 4)"/>
      <rect x="21" y="3" width="7" height="3" fill="#a16207" rx="1" transform="rotate(20 24 4)"/>
      <rect x="1" y="22" width="8" height="7" fill="#92400e" rx="1" transform="rotate(10 5 25)"/>
      <rect x="2" y="23" width="6" height="5" fill="#b45309" rx="1" transform="rotate(10 5 25)"/>
      <rect x="21" y="23" width="9" height="6" fill="#78350f" rx="1" transform="rotate(-12 25 26)"/>
      <rect x="22" y="24" width="7" height="4" fill="#a16207" rx="1" transform="rotate(-12 25 26)"/>
      <rect x="13" y="12" width="5" height="5" fill="#92400e" rx="1" transform="rotate(30 15 14)"/>
    </svg>`,
    itemLife: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#0f172a" rx="3"/>
      <path d="M16 26 C8 21 4 16 4 11 C4 7 7 4 11 4 C13.5 4 15.5 5.5 16 7 C16.5 5.5 18.5 4 21 4 C25 4 28 7 28 11 C28 16 24 21 16 26Z" fill="#ef4444"/>
      <path d="M16 23 C9 19 6 15 6 11 C6 8.5 8.2 6.5 11 6.5 C13 6.5 14.5 8 16 10 C17.5 8 19 6.5 21 6.5 C23.8 6.5 26 8.5 26 11 C26 15 23 19 16 23Z" fill="#f87171"/>
    </svg>`,
    itemRange: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#0f172a" rx="3"/>
      <polygon points="20,3 10,18 16,18 12,29 22,14 16,14" fill="#f97316"/>
      <polygon points="20,3 11,17 17,17 13,27 21,13 15.5,13" fill="#fbbf24"/>
    </svg>`,
    itemBomb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#0f172a" rx="3"/>
      <circle cx="13" cy="20" r="8" fill="#111827"/>
      <circle cx="13" cy="20" r="8" fill="none" stroke="#374151" stroke-width="1.5"/>
      <line x1="13" y1="12" x2="17" y2="8" stroke="#78350f" stroke-width="2" stroke-linecap="round"/>
      <circle cx="18" cy="7" r="2.5" fill="#f97316"/>
      <rect x="22" y="14" width="8" height="2.5" fill="#a78bfa" rx="1"/>
      <rect x="24.75" y="11.5" width="2.5" height="8" fill="#a78bfa" rx="1"/>
    </svg>`,
    itemStar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#0f172a" rx="3"/>
      <polygon points="16,3 20,12 30,12 22,19 25,29 16,23 7,29 10,19 2,12 12,12" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>
      <polygon points="16,7 19.5,14 27,14 21,19 23.5,26 16,21.5 8.5,26 11,19 5,14 12.5,14" fill="#fde68a"/>
    </svg>`,
};

/** Chuyển SVG string sang CSS url() data URI */
export const svgUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
