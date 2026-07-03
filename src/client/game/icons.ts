/**
 * SVG icon set for Suhdokuh UI.
 *
 * Architecture:
 *   - Every icon is defined exactly once, exported as a named constant.
 *   - The ICONS map and injectIcons() allow static HTML to use lightweight
 *     <span class="icon" data-icon="name"> placeholders that are populated
 *     at runtime.
 *   - Dynamic content in game.ts imports the named constants directly.
 *
 * Style: 24x24 viewBox, stroke-width 2, round caps/joins, currentColor.
 */

function svg(paths: string): string {
  return `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

// ── Icon definitions ──────────────────────────────────────────────

export const ICON_TROPHY = svg(`
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C6 4 6 6 6 9z"/>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C18 4 18 6 18 9z"/>
  <path d="M4 22h16"/>
  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
`);

export const ICON_MEDAL_GOLD = svg(`
  <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" fill="currentColor" stroke="none"/>
  <circle cx="12" cy="12" r="10"/>
`);

export const ICON_MEDAL_SILVER = svg(`
  <circle cx="12" cy="12" r="8"/>
  <path d="M6 3 12 6l6-3"/>
  <path d="M6 21 12 18l6 3"/>
`);

export const ICON_MEDAL_BRONZE = svg(`
  <circle cx="12" cy="12" r="8"/>
  <circle cx="12" cy="12" r="5"/>
  <circle cx="12" cy="12" r="2"/>
`);

export const ICON_LIGHTBULB = svg(`
  <path d="M15 14c.2-1 .7-1.7 1.5-2.5A4.7 4.7 0 0 0 18 8a6 6 0 0 0-12 0c0 1 .2 2.2 1.5 3.5.7.8 1.3 1.5 1.5 2.5"/>
  <path d="M9 18h6"/>
  <path d="M10 22h4"/>
`);

export const ICON_SPARKLES = svg(`
  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
`);

export const ICON_PENCIL = svg(`
  <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
  <path d="m15 5 4 4"/>
`);

export const ICON_PLAY = svg(`
  <polygon points="6 3 20 12 6 21 6 3"/>
`);

export const ICON_CHEVRON_RIGHT = svg(`
  <polyline points="9 18 15 12 9 6"/>
`);

export const ICON_CLOCK = svg(`
  <circle cx="12" cy="12" r="10"/>
  <polyline points="12 6 12 12 16 14"/>
`);

export const ICON_UNDO = svg(`
  <path d="M3 7v6h6"/>
  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
`);

export const ICON_REDO = svg(`
  <path d="M21 7v6h-6"/>
  <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
`);

export const ICON_REFRESH = svg(`
  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
  <path d="M3 3v5h5"/>
  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
  <path d="M21 21v-5h-5"/>
`);

export const ICON_BOOK = svg(`
  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5"/>
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
  <line x1="8" y1="7" x2="14" y2="7"/>
  <line x1="8" y1="11" x2="12" y2="11"/>
`);

export const ICON_BAR_CHART = svg(`
  <line x1="12" y1="20" x2="12" y2="10"/>
  <line x1="18" y1="20" x2="18" y2="4"/>
  <line x1="6" y1="20" x2="6" y2="16"/>
`);

export const ICON_DIFFICULTY = svg(`
  <line x1="4" y1="21" x2="4" y2="14"/>
  <line x1="9" y1="21" x2="9" y2="10"/>
  <line x1="14" y1="21" x2="14" y2="6"/>
  <line x1="19" y1="21" x2="19" y2="2"/>
`);

export const ICON_GRID = svg(`
  <rect x="3" y="3" width="7" height="7"/>
  <rect x="14" y="3" width="7" height="7"/>
  <rect x="3" y="14" width="7" height="7"/>
  <rect x="14" y="14" width="7" height="7"/>
`);

export const ICON_GAMEPAD = svg(`
  <line x1="6" y1="11" x2="10" y2="11"/>
  <line x1="8" y1="9" x2="8" y2="13"/>
  <line x1="15" y1="12" x2="15.01" y2="12"/>
  <line x1="18" y1="10" x2="18.01" y2="10"/>
  <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>
`);

export const ICON_CIRCLE_HELP = svg(`
  <circle cx="12" cy="12" r="10"/>
  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
  <path d="M12 17h.01"/>
`);

export const ICON_PALETTE = svg(`
  <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
  <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
  <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
  <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.55 1.5-1.5 0-.35-.14-.67-.33-.92a1.5 1.5 0 0 1 .33-2.33C14.5 16.5 16 15 16 13c0-1.5 1.3-2 2.5-2 1.5 0 3.5 1 3.5 4 0 4.97-4.03 9-10 9C6.47 22 2 17.52 2 12S6.47 2 12 2z"/>
`);

export const ICON_INFO = svg(`
  <circle cx="12" cy="12" r="10"/>
  <path d="M12 16v-4"/>
  <path d="M12 8h.01"/>
`);

export const ICON_X = svg(`
  <path d="M18 6 6 18"/>
  <path d="m6 6 12 12"/>
`);

export const ICON_CHECK = svg(`
  <polyline points="20 6 9 17 4 12"/>
`);

export const ICON_PUZZLE = svg(`
  <path d="M19.44 12.86a1 1 0 0 0 .56-.86v-1a1 1 0 0 0-1-1h-1.5a1 1 0 0 1-1-1V7.5a1 1 0 0 0-1-1h-1a1 1 0 0 0-.86.56"/>
  <path d="M8.5 6.5a1 1 0 0 0-.86-.56h-1a1 1 0 0 0-1 1V8.5a1 1 0 0 1-1 1H3a1 1 0 0 0-1 1v1a1 1 0 0 0 .56.86"/>
  <path d="M6.5 17.5a1 1 0 0 0 .86.56h1a1 1 0 0 0 1-1V15.5a1 1 0 0 1 1-1H12a1 1 0 0 0 1-1v-1a1 1 0 0 0-.56-.86"/>
  <path d="M17.5 13.5a1 1 0 0 0-.86.56V15.5a1 1 0 0 1-1 1H14a1 1 0 0 0-1 1v1a1 1 0 0 0 .56.86"/>
  <circle cx="19.5" cy="19.5" r="2.5"/>
`);

// ── Icon injection for static HTML ─────────────────────────────────

const ICONS = {
  help: ICON_CIRCLE_HELP,
  stats: ICON_BAR_CHART,
  appearance: ICON_PALETTE,
  puzzle: ICON_PUZZLE,
  clock: ICON_CLOCK,
  undo: ICON_UNDO,
  redo: ICON_REDO,
  hint: ICON_LIGHTBULB,
  refresh: ICON_REFRESH,
  trophy: ICON_TROPHY,
  book: ICON_BOOK,
  grid: ICON_GRID,
  gamepad: ICON_GAMEPAD,
  sparkles: ICON_SPARKLES,
  close: ICON_X,
  check: ICON_CHECK,
  play: ICON_PLAY,
  info: ICON_INFO,
  difficulty: ICON_DIFFICULTY,
} as const;

export type IconName = keyof typeof ICONS;

/**
 * Replace every <span class="icon" data-icon="name"></span> in the given
 * root (or the whole document) with the corresponding SVG.
 *
 * Idempotent: elements that already contain an <svg> child are skipped.
 * The data-icon attribute is preserved as documentation and to support
 * future reinjection.
 */
export function injectIcons(root: HTMLElement | Document = document): void {
  root.querySelectorAll('[data-icon]').forEach(el => {
    if (el.querySelector('svg')) return;
    const name = el.getAttribute('data-icon') as IconName | null;
    if (name && name in ICONS) {
      el.innerHTML = ICONS[name];
      // data-icon attribute is intentionally kept for documentation
    }
  });
}
