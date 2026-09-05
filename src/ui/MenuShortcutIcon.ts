/** Small, font-independent symbols with a shared optical size and brass outline. */
const ICON_PATHS = {
  activities: '<path d="M5 5h22v22H5Z" fill="#3b8981"/><path d="M8 8h16v16H8Z" fill="none" stroke="#fff1b4" stroke-dasharray="2 3"/><path d="m16 8 3 5 5 3-5 3-3 5-3-5-5-3 5-3Z" fill="#fff1b4"/><path d="M3 13h3m20 6h3M13 3v3m6 20v3"/>',
  guide: '<path d="M11 11a5 5 0 0 1 10 0c0 4-5 4-5 8" fill="none" stroke-width="3"/><circle cx="16" cy="24" r="1.8" stroke="none" fill="currentColor"/>',
  leaderboard: '<path d="m5 10 5 4 6-8 6 8 5-4-3 13H8Z" fill="#fff1b4"/><path d="M9 26h14M9 20h14"/><path d="m16 13 2 3-2 3-2-3Z" fill="#3b8981"/><circle cx="5" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="27" cy="8" r="1.5" fill="currentColor" stroke="none"/>',
  story: '<path d="M10 5h14a3 3 0 0 1 0 6h-3v12a4 4 0 0 1-4 4H8a3 3 0 0 1 0-6h3V9a4 4 0 0 0-4-4Z" fill="#fff1b4"/><path d="M21 11V8a3 3 0 0 1 3-3M8 21a3 3 0 0 1 0 6M14 13h4M14 17h4" fill="none"/>',
  workshop: '<path d="M16 9C12 6 7 6 3 7v18c5-1 9 0 13 3 4-3 8-4 13-3V7c-4-1-9-1-13 2Z" fill="#fff1b4"/><path d="M16 9v19M7 18h5M7 22h5M20 18h5M20 22h5" fill="none"/><path d="m10 9 1.1 2.5L14 13l-2.9 1.5L10 17l-1.1-2.5L6 13l2.9-1.5Z" fill="#3b8981" stroke-width="1.3"/><path d="M21 7v7l2-1 2 1V6" fill="#a65a70"/>',
  profile: '<circle cx="16" cy="11" r="5" fill="#fff1b4"/><path d="M6 26v-2a10 10 0 0 1 20 0v2Z" fill="#fff1b4"/><path d="M12 20a5 5 0 0 0 8 0" fill="none"/>',
} as const;

export function renderMenuShortcutIcon(icon: keyof typeof ICON_PATHS): string {
  return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[icon]}</svg>`;
}
