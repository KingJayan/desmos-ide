
export type DividerName = 'editor' | 'pane' | 'toolLeft' | 'bottom' | 'ai';
export type LeftView = 'git' | 'outline' | 'plugins';
export type BottomTab = 'problems' | 'timeline' | 'optimizer';
export type MaximizedPane = 'editor' | 'graph';

export interface LayoutState {
  sizes: Partial<Record<DividerName, number>>;
  leftView: LeftView | null;
  aiOpen: boolean;
  bottomOpen: boolean;
  bottomTab: BottomTab;
  maximized: MaximizedPane | null;
}

export const DIVIDERS: readonly DividerName[] = ['editor', 'pane', 'toolLeft', 'bottom', 'ai'];
const LEFT_VIEWS: readonly string[] = ['git', 'outline', 'plugins'];
const BOTTOM_TABS: readonly string[] = ['problems', 'timeline', 'optimizer'];
const MAXIMIZED: readonly string[] = ['editor', 'graph'];

const KEY = 'ide-layout';

export const DEFAULT_LAYOUT: LayoutState = {
  sizes: {},
  leftView: null,
  aiOpen: false,
  bottomOpen: false,
  bottomTab: 'problems',
  maximized: null,
};

export function parseLayout(raw: string | null): LayoutState {
  if (!raw) return { ...DEFAULT_LAYOUT, sizes: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_LAYOUT, sizes: {} };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ...DEFAULT_LAYOUT, sizes: {} };
  }
  const s = parsed as Record<string, unknown>;
  const rawSizes = typeof s.sizes === 'object' && s.sizes !== null ? s.sizes as Record<string, unknown> : {};
  const sizes: Partial<Record<DividerName, number>> = {};
  for (const name of DIVIDERS) {
    const value = Number(rawSizes[name]);
    if (Number.isFinite(value) && value > 0) sizes[name] = Math.round(value);
  }
  return {
    sizes,
    leftView: LEFT_VIEWS.includes(s.leftView as string) ? s.leftView as LeftView : null,
    aiOpen: s.aiOpen === true,
    bottomOpen: s.bottomOpen === true,
    bottomTab: BOTTOM_TABS.includes(s.bottomTab as string) ? s.bottomTab as BottomTab : 'problems',
    maximized: MAXIMIZED.includes(s.maximized as string) ? s.maximized as MaximizedPane : null,
  };
}

function store(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function loadLayout(): LayoutState {
  return parseLayout(store()?.getItem(KEY) ?? null);
}

export function saveLayout(state: LayoutState): void {
  try { store()?.setItem(KEY, JSON.stringify(state)); } catch { /* private mode has no store */ }
}
