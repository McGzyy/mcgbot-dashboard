/** Prefer a visible match when the same `data-tutorial` exists on desktop + mobile sidebars. */
export function queryFirstVisibleTutorialTarget(selector: string): HTMLElement | null {
  let nodes: NodeListOf<Element>;
  try {
    nodes = document.querySelectorAll(selector);
  } catch {
    return null;
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!(n instanceof HTMLElement)) continue;
    if (!n.isConnected) continue;
    if (!isTutorialTargetChainVisible(n)) continue;
    const r = n.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) continue;
    return n;
  }
  return null;
}

function isTutorialTargetChainVisible(el: HTMLElement): boolean {
  let p: HTMLElement | null = el;
  while (p) {
    if (p === document.body) break;
    const st = getComputedStyle(p);
    if (st.display === "none" || st.visibility === "hidden") return false;
    p = p.parentElement;
  }
  return true;
}

const stableVisibleGetters = new Map<string, () => HTMLElement | null>();

/** Stable function identity per selector (react-joyride compares `step.target` while polling). */
export function stableVisibleTutorialTargetGetter(selector: string): () => HTMLElement | null {
  let g = stableVisibleGetters.get(selector);
  if (!g) {
    g = () => queryFirstVisibleTutorialTarget(selector);
    stableVisibleGetters.set(selector, g);
  }
  return g;
}

export function tutorialSelectorUsesDataTutorial(selector: string): boolean {
  return selector.trimStart().startsWith("[data-tutorial=");
}

/**
 * Left rail tags the same `data-tutorial` on the desktop `aside` and the mobile drawer.
 * `querySelector` would often hit the hidden desktop node; resolve the visible link instead.
 * Page-only anchors (e.g. `watchlist.manage`) stay plain selectors so Joyride spotlight measures reliably.
 */
export function isSidebarDuplicateTutorialSelector(selector: string): boolean {
  const t = selector.trim();
  return t.startsWith('[data-tutorial="sidebar.');
}
