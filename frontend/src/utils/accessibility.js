const LIVE_REGION_ID = "anything-llm-a11y-live";
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
]
  .map((selector) => `${selector}:not([aria-hidden="true"])`)
  .join(',');

function ensureLiveRegion(politeness = "polite") {
  if (typeof document === "undefined") return null;
  let region = document.getElementById(LIVE_REGION_ID);
  if (!region) {
    region = document.createElement("div");
    region.id = LIVE_REGION_ID;
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", politeness);
    region.setAttribute("aria-atomic", "true");
    region.style.position = "fixed";
    region.style.width = "1px";
    region.style.height = "1px";
    region.style.margin = "-1px";
    region.style.border = "0";
    region.style.padding = "0";
    region.style.overflow = "hidden";
    region.style.clip = "rect(0 0 0 0)";
    document.body.appendChild(region);
  } else {
    region.setAttribute("aria-live", politeness);
  }
  return region;
}

export function announce(message, politeness = "polite") {
  if (!message || typeof document === "undefined") return;
  const region = ensureLiveRegion(politeness);
  if (!region) return;
  window.requestAnimationFrame(() => {
    region.textContent = "";
    window.requestAnimationFrame(() => {
      region.textContent = message;
    });
  });
}

export function getFocusableElements(container) {
  if (!container) return [];
  const elements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  if (container.matches?.(FOCUSABLE_SELECTOR)) {
    elements.unshift(container);
  }
  return elements.filter((element) =>
    element instanceof HTMLElement && !element.hasAttribute("disabled")
  );
}

export function focusFirstDescendant(container) {
  const focusables = getFocusableElements(container);
  for (const element of focusables) {
    if (typeof element.focus === "function") {
      element.focus();
      return element;
    }
  }
  if (container instanceof HTMLElement && typeof container.focus === "function") {
    container.focus();
  }
  return null;
}

export function trapFocusWithin(container) {
  if (!container) return () => {};
  function handleKeyDown(event) {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === first || activeElement === container) {
        event.preventDefault();
        last.focus();
      }
    } else if (activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  container.addEventListener("keydown", handleKeyDown);
  return () => container.removeEventListener("keydown", handleKeyDown);
}

function normalizeChannel(channel) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  const sanitized = hex?.replace?.("#", "");
  if (!sanitized || sanitized.length < 6) return { r: 0, g: 0, b: 0 };
  const bigint = Number.parseInt(sanitized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const red = normalizeChannel(r);
  const green = normalizeChannel(g);
  const blue = normalizeChannel(b);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground, background) {
  const luminance1 = relativeLuminance(foreground);
  const luminance2 = relativeLuminance(background);
  const brightest = Math.max(luminance1, luminance2);
  const darkest = Math.min(luminance1, luminance2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

export function auditContrastRatios(palette = {}) {
  const pairs = [
    {
      id: "text-on-background",
      foreground: palette.text,
      background: palette.background,
      minimum: 4.5,
      label: "Primary text on background",
    },
    {
      id: "text-on-surface",
      foreground: palette.text,
      background: palette.surface,
      minimum: 4.5,
      label: "Primary text on surface",
    },
    {
      id: "accent-on-background",
      foreground: palette.accent,
      background: palette.background,
      minimum: 3,
      label: "Accent on background",
    },
    {
      id: "danger-on-surface",
      foreground: palette.danger,
      background: palette.surface,
      minimum: 3,
      label: "Danger on surface",
    },
  ];

  const results = pairs.map((pair) => ({
    ...pair,
    ratio: contrastRatio(pair.foreground, pair.background),
  }));

  const issues = results.filter((result) => result.ratio < result.minimum);
  return {
    passed: issues.length === 0,
    results,
    issues,
  };
}

export function formatContrastReport(report) {
  if (!report) return [];
  return report.results.map((result) => ({
    id: result.id,
    label: result.label,
    ratio: result.ratio,
    minimum: result.minimum,
    passed: result.ratio >= result.minimum,
  }));
}

export function describeContrastFailures(report) {
  if (!report || !Array.isArray(report.issues) || report.issues.length === 0)
    return "";
  return report.issues
    .map((issue) => `${issue.label} (ratio ${issue.ratio} < ${issue.minimum})`)
    .join("; ");
}

export function restoreFocus(element) {
  if (!element || typeof element.focus !== "function") return;
  element.focus();
}

export function isFocusable(element) {
  if (!element) return false;
  if (element.matches?.(FOCUSABLE_SELECTOR)) return true;
  return false;
}

export const AccessibilityHelpers = Object.freeze({
  announce,
  auditContrastRatios,
  contrastRatio,
  describeContrastFailures,
  focusFirstDescendant,
  getFocusableElements,
  isFocusable,
  restoreFocus,
  trapFocusWithin,
});

export default AccessibilityHelpers;
