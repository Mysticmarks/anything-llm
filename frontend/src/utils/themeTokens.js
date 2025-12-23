import {
  auditContrastRatios,
  contrastRatio,
  describeContrastFailures,
  formatContrastReport,
} from "@/utils/accessibility";

export const DARK_MODE_TOKEN_BASE = {
  "--theme-bg-primary": "#0e0f0f",
  "--theme-bg-secondary": "#1b1b1e",
  "--theme-bg-sidebar": "#0e0f0f",
  "--theme-bg-container": "#0e0f0f",
  "--theme-bg-chat": "#1b1b1e",
  "--theme-bg-chat-input": "#27282a",
  "--theme-text-primary": "#ffffff",
  "--theme-text-secondary": "rgba(255, 255, 255, 0.6)",
  "--theme-sidebar-border": "rgba(255, 255, 255, 0.1)",
  "--theme-border-strong": "#3f3f42",
};

export const DEFAULT_PROCEDURAL_CONFIG = {
  darkModeFloor: 16,
  accentSaturationBoost: 8,
  overlayOpacity: 0.75,
};

export function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function numberOrFallback(value, fallback) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

export function validateProceduralConfig(config = {}) {
  const darkModeFloor = clamp(
    numberOrFallback(config.darkModeFloor, DEFAULT_PROCEDURAL_CONFIG.darkModeFloor),
    0,
    40
  );
  const accentSaturationBoost = clamp(
    numberOrFallback(
      config.accentSaturationBoost,
      DEFAULT_PROCEDURAL_CONFIG.accentSaturationBoost
    ),
    0,
    20
  );
  const overlayOpacity = clamp(
    numberOrFallback(config.overlayOpacity, DEFAULT_PROCEDURAL_CONFIG.overlayOpacity),
    0.35,
    0.92
  );

  return { darkModeFloor, accentSaturationBoost, overlayOpacity };
}

export function hexToRgb(hex) {
  const sanitized = hex.replace("#", "");
  const bigint = parseInt(sanitized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => {
      const clamped = clamp(Math.round(value), 0, 255).toString(16);
      return clamped.length === 1 ? `0${clamped}` : clamped;
    })
    .join("")}`;
}

export function hsvToHex({ h, s, v }) {
  const saturation = clamp(s, 0, 100) / 100;
  const value = clamp(v, 0, 100) / 100;
  const hue = ((h % 360) + 360) % 360;
  const c = value * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - c;
  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) {
    rPrime = c;
    gPrime = x;
  } else if (hue < 120) {
    rPrime = x;
    gPrime = c;
  } else if (hue < 180) {
    gPrime = c;
    bPrime = x;
  } else if (hue < 240) {
    gPrime = x;
    bPrime = c;
  } else if (hue < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  const r = Math.round((rPrime + m) * 255);
  const g = Math.round((gPrime + m) * 255);
  const b = Math.round((bPrime + m) * 255);

  return rgbToHex(r, g, b);
}

export function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const cMax = Math.max(rNorm, gNorm, bNorm);
  const cMin = Math.min(rNorm, gNorm, bNorm);
  const delta = cMax - cMin;

  let h = 0;
  if (delta !== 0) {
    switch (cMax) {
      case rNorm:
        h = ((gNorm - bNorm) / delta) % 6;
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      default:
        h = (rNorm - gNorm) / delta + 4;
        break;
    }
    h *= 60;
  }

  const s = cMax === 0 ? 0 : delta / cMax;
  const v = cMax;

  return {
    h: (h + 360) % 360,
    s: s * 100,
    v: v * 100,
  };
}

export function convertHexPaletteToHsv(hexPalette) {
  return Object.fromEntries(
    Object.entries(hexPalette).map(([key, value]) => [key, hexToHsv(value)])
  );
}

export function convertPaletteToHex(palette) {
  return Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [key, hsvToHex(value)])
  );
}

export function mix(hexA, hexB, weight = 0.5) {
  const { r: r1, g: g1, b: b1 } = hexToRgb(hexA);
  const { r: r2, g: g2, b: b2 } = hexToRgb(hexB);
  const w = clamp(weight, 0, 1);
  const r = r1 * (1 - w) + r2 * w;
  const g = g1 * (1 - w) + g2 * w;
  const b = b1 * (1 - w) + b2 * w;
  return rgbToHex(r, g, b);
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

export function adjustValue(hex, delta) {
  const hsv = hexToHsv(hex);
  return hsvToHex({ ...hsv, v: clamp(hsv.v + delta, 0, 100) });
}

export function adjustSaturation(hex, delta) {
  const hsv = hexToHsv(hex);
  return hsvToHex({ ...hsv, s: clamp(hsv.s + delta, 0, 100) });
}

export function deriveCssVariables(paletteHex) {
  const background = paletteHex.background;
  const surface = paletteHex.surface;
  const sidebar = paletteHex.sidebar;
  const chat = paletteHex.chat;
  const accent = paletteHex.accent;
  const accentMuted = paletteHex.accentMuted;
  const textPrimary = paletteHex.text;
  const textSecondary = paletteHex.textMuted;
  const success = paletteHex.success;
  const warning = paletteHex.warning;
  const danger = paletteHex.danger;
  const border = paletteHex.border;

  const subtleAccent = mix(accent, surface, 0.2);
  const hoverAccent = mix(accent, surface, 0.35);
  const inverseText = mix(textPrimary, background, 0.5);
  const sidebarEmphasis = mix(sidebar, accent, 0.3);
  const sidebarSoft = mix(sidebar, textPrimary, 0.15);
  const sidebarAlt = mix(sidebar, accentMuted, 0.2);
  const placeholder = mix(textSecondary, background, 0.4);
  const elevated = mix(surface, background, 0.5);
  const menuBg = mix(surface, background, 0.35);
  const checklistHover = mix(accent, surface, 0.25);
  const buttonSecondary = mix(surface, background, 0.65);

  return {
    "--theme-loader": textPrimary,
    "--theme-bg-primary": background,
    "--theme-bg-secondary": surface,
    "--theme-bg-sidebar": sidebar,
    "--theme-bg-container": elevated,
    "--theme-bg-chat": chat,
    "--theme-bg-chat-input": mix(chat, accentMuted, 0.2),
    "--theme-text-primary": textPrimary,
    "--theme-text-secondary": textSecondary,
    "--theme-placeholder": placeholder,
    "--theme-sidebar-item-default": withAlpha(sidebarSoft, 0.75),
    "--theme-sidebar-item-selected": withAlpha(sidebarEmphasis, 0.85),
    "--theme-sidebar-item-hover": sidebarEmphasis,
    "--theme-sidebar-subitem-default": withAlpha(sidebarSoft, 0.55),
    "--theme-sidebar-subitem-selected": withAlpha(sidebarEmphasis, 0.6),
    "--theme-sidebar-thread-selected": withAlpha(sidebarEmphasis, 0.5),
    "--theme-popup-menu-bg": menuBg,
    "--theme-sidebar-subitem-hover": sidebarAlt,
    "--theme-sidebar-border": withAlpha(border, 0.7),
    "--theme-sidebar-item-workspace-active": textPrimary,
    "--theme-sidebar-item-workspace-inactive": textSecondary,
    "--theme-sidebar-footer-icon": withAlpha(textSecondary, 0.15),
    "--theme-sidebar-footer-icon-fill": textPrimary,
    "--theme-home-border": border,
    "--theme-home-button-primary": accent,
    "--theme-home-button-secondary-border": withAlpha(border, 0.6),
    "--theme-home-button-secondary-border-hover": border,
    "--theme-home-text": textPrimary,
    "--theme-home-text-secondary": textSecondary,
    "--theme-home-button-primary-text": withAlpha(textPrimary, 0.95),
    "--theme-home-button-primary-hover": hoverAccent,
    "--theme-home-button-primary-border": hoverAccent,
    "--theme-home-button-primary-focus": hoverAccent,
    "--theme-home-button-secondary-text": textPrimary,
    "--theme-home-button-secondary-bg": buttonSecondary,
    "--theme-home-button-secondary-focus": buttonSecondary,
    "--theme-settings-input-bg": mix(surface, background, 0.1),
    "--theme-settings-input-text": textPrimary,
    "--theme-settings-input-border": withAlpha(border, 0.6),
    "--theme-settings-input-label": withAlpha(textSecondary, 0.8),
    "--theme-settings-input-focus": hoverAccent,
    "--theme-settings-nav-bg": surface,
    "--theme-settings-nav-hover": sidebarEmphasis,
    "--theme-settings-nav-text": textPrimary,
    "--theme-modal-bg": elevated,
    "--theme-modal-border": withAlpha(border, 0.35),
    "--theme-modal-divider": withAlpha(border, 0.4),
    "--theme-modal-section-border": withAlpha(border, 0.3),
    "--theme-modal-section-bg": mix(surface, background, 0.2),
    "--theme-modal-close": textSecondary,
    "--theme-modal-close-hover": textPrimary,
    "--theme-activity-border": withAlpha(border, 0.5),
    "--theme-activity-bg": mix(surface, background, 0.2),
    "--theme-activity-text": textPrimary,
    "--theme-activity-muted": textSecondary,
    "--theme-activity-icon": textSecondary,
    "--theme-chat-prompt-bg": chat,
    "--theme-chat-prompt-border": withAlpha(border, 0.6),
    "--theme-chat-prompt-placeholder": placeholder,
    "--theme-chat-reply-bg": mix(chat, background, 0.1),
    "--theme-chat-reply-border": withAlpha(border, 0.5),
    "--theme-workspace-card-bg": surface,
    "--theme-workspace-card-border": withAlpha(border, 0.5),
    "--theme-workspace-card-text": textPrimary,
    "--theme-toast-bg": mix(surface, background, 0.15),
    "--theme-toast-border": withAlpha(border, 0.45),
    "--theme-toast-text": textPrimary,
    "--theme-toast-subtext": textSecondary,
    "--theme-toast-icon": textPrimary,
    "--theme-button-primary": accent,
    "--theme-button-primary-hover": hoverAccent,
    "--theme-button-primary-text": textPrimary,
    "--theme-button-secondary": buttonSecondary,
    "--theme-button-secondary-hover": mix(buttonSecondary, accent, 0.15),
    "--theme-button-secondary-text": textPrimary,
    "--theme-button-secondary-border": withAlpha(border, 0.65),
    "--theme-button-tertiary": withAlpha(accent, 0.1),
    "--theme-button-tertiary-text": accent,
    "--theme-button-tertiary-hover": withAlpha(accent, 0.2),
    "--theme-button-tertiary-border": withAlpha(accent, 0.2),
    "--theme-button-primary-outline-text": accent,
    "--theme-button-primary-outline-border": mix(accent, border, 0.2),
    "--theme-button-primary-outline-hover": hoverAccent,
    "--theme-action-primary": accent,
    "--theme-action-secondary": accentMuted,
    "--theme-action-ghost-hover": withAlpha(accent, 0.12),
    "--theme-badge-bg": withAlpha(accentMuted, 0.4),
    "--theme-badge-text": inverseText,
    "--theme-tooltip-bg": menuBg,
    "--theme-tooltip-text": textPrimary,
    "--theme-progress-bg": withAlpha(accent, 0.25),
    "--theme-progress-fill": accent,
    "--theme-progress-border": withAlpha(accent, 0.45),
    "--theme-status-success-bg": withAlpha(success, 0.25),
    "--theme-status-success-text": mix(success, textPrimary, 0.2),
    "--theme-status-warning-bg": withAlpha(warning, 0.25),
    "--theme-status-warning-text": mix(warning, textPrimary, 0.2),
    "--theme-status-danger-bg": withAlpha(danger, 0.25),
    "--theme-status-danger-text": mix(danger, textPrimary, 0.2),
    "--theme-checkbox-bg": surface,
    "--theme-checkbox-border": withAlpha(border, 0.65),
    "--theme-checkbox-checkmark": textPrimary,
    "--theme-input-bg": mix(surface, background, 0.25),
    "--theme-input-border": withAlpha(border, 0.5),
    "--theme-input-text": textPrimary,
    "--theme-input-placeholder": placeholder,
    "--theme-input-focus": hoverAccent,
    "--theme-card-shadow": withAlpha(textPrimary, 0.05),
    "--theme-surface-highlight": subtleAccent,
    "--theme-chart-gridline": withAlpha(border, 0.35),
    "--theme-chart-accent": accent,
    "--theme-chart-accent-muted": accentMuted,
    "--theme-chart-surface": mix(surface, background, 0.2),
    "--theme-sidebar-shadow": withAlpha(textPrimary, 0.15),
    "--theme-menu-item-hover": withAlpha(accent, 0.12),
    "--theme-menu-item-active": withAlpha(accent, 0.15),
    "--theme-menu-item-text": textPrimary,
    "--theme-helpcallout-bg": mix(surface, background, 0.18),
    "--theme-helpcallout-border": withAlpha(border, 0.55),
    "--theme-helpcallout-title": textPrimary,
    "--theme-helpcallout-body": textSecondary,
    "--theme-accordion-border": withAlpha(border, 0.4),
    "--theme-accordion-hover": withAlpha(accent, 0.08),
    "--theme-accordion-active": withAlpha(accent, 0.14),
    "--theme-checklist-header": withAlpha(textPrimary, 0.95),
    "--theme-checklist-border": withAlpha(border, 0.45),
    "--theme-checklist-bg": elevated,
    "--theme-checklist-highlight": checklistHover,
    "--theme-checklist-filter-bg": withAlpha(surface, 0.65),
    "--theme-checklist-filter-active": withAlpha(accent, 0.22),
    "--theme-checklist-filter-text": textPrimary,
    "--theme-checklist-item-completed-bg": withAlpha(accentMuted, 0.2),
    "--theme-checklist-item-completed-text": mix(success, textPrimary, 0.6),
    "--theme-checklist-checkbox-fill": success,
    "--theme-checklist-checkbox-text": mix(success, surface, 0.3),
    "--theme-checklist-item-hover": accent,
    "--theme-checklist-checkbox-border": mix(success, border, 0.5),
    "--theme-checklist-button-border": accent,
    "--theme-checklist-button-text": accent,
    "--theme-checklist-button-hover-bg": withAlpha(accent, 0.2),
    "--theme-checklist-button-hover-border": withAlpha(accent, 0.3),
    "--theme-attachment-bg": elevated,
    "--theme-attachment-error-bg": withAlpha(danger, 0.35),
    "--theme-attachment-success-bg": withAlpha(success, 0.3),
    "--theme-attachment-text": textPrimary,
    "--theme-attachment-text-secondary": textSecondary,
    "--theme-attachment-icon": textPrimary,
    "--theme-attachment-icon-spinner": textPrimary,
    "--theme-attachment-icon-spinner-bg": elevated,
    "--theme-button-text": textSecondary,
    "--theme-button-code-hover-text": accent,
    "--theme-button-code-hover-bg": withAlpha(accentMuted, 0.65),
    "--theme-button-disable-hover-text": warning,
    "--theme-button-disable-hover-bg": withAlpha(warning, 0.3),
    "--theme-button-delete-hover-text": danger,
    "--theme-button-delete-hover-bg": withAlpha(danger, 0.3),
  };
}

export function buildProceduralPalette(paletteHex, config = DEFAULT_PROCEDURAL_CONFIG) {
  const normalized = validateProceduralConfig(config);
  const darkSurface = clamp(normalized.darkModeFloor, 0, 40);
  const backgroundHsv = hexToHsv(paletteHex.background);
  const surfaceFloor = Math.max(darkSurface, backgroundHsv.v - 8);
  const adjustedBackground = hsvToHex({ ...backgroundHsv, v: surfaceFloor });

  const accentSaturated = adjustSaturation(
    paletteHex.accent,
    normalized.accentSaturationBoost
  );
  const accentContrastColor =
    contrastRatio(accentSaturated, "#000000") >= 4.5 ? "#000000" : "#ffffff";

  const tokens = {
    surfaceRaised: mix(paletteHex.surface, adjustedBackground, 0.35),
    surfaceSunken: mix(paletteHex.surface, adjustedBackground, 0.15),
    surfaceBorder: withAlpha(paletteHex.border, 0.55),
    borderStrong: mix(paletteHex.border, paletteHex.text, 0.25),
    accentStrong: adjustValue(accentSaturated, 6),
    accentMuted: withAlpha(accentSaturated, 0.18),
    accentContrast: accentContrastColor,
    overlaySoft: withAlpha(adjustedBackground, normalized.overlayOpacity),
    overlayStrong: withAlpha(adjustedBackground, normalized.overlayOpacity + 0.1),
    successStrong: adjustValue(paletteHex.success, 6),
    warningStrong: adjustValue(paletteHex.warning, 6),
    dangerStrong: adjustValue(paletteHex.danger, 6),
  };

  const cssVars = {
    "--theme-surface-raised": tokens.surfaceRaised,
    "--theme-surface-sunken": tokens.surfaceSunken,
    "--theme-surface-border": tokens.surfaceBorder,
    "--theme-border-strong": tokens.borderStrong,
    "--theme-accent-strong": tokens.accentStrong,
    "--theme-accent-muted": tokens.accentMuted,
    "--theme-accent-contrast": tokens.accentContrast,
    "--theme-overlay-soft": tokens.overlaySoft,
    "--theme-overlay-strong": tokens.overlayStrong,
    "--theme-status-success-strong": tokens.successStrong,
    "--theme-status-warning-strong": tokens.warningStrong,
    "--theme-status-danger-strong": tokens.dangerStrong,
  };

  return { tokens, cssVars };
}

export function resolveAnimationTokens(animationKey, multiplier = 1) {
  const MOTION_CURVES = {
    reduced: {
      standard: "linear",
      emphasized: "linear",
      entrance: "linear",
    },
    balanced: {
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      emphasized: "cubic-bezier(0.16, 1, 0.3, 1)",
      entrance: "cubic-bezier(0.05, 0.7, 0.1, 1)",
    },
    expressive: {
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      emphasized: "cubic-bezier(0.2, 0, 0, 1)",
      entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
    },
  };

  const MOTION_DURATIONS = {
    reduced: {
      short: 120,
      medium: 160,
      long: 220,
    },
    balanced: {
      short: 160,
      medium: 240,
      long: 320,
    },
    expressive: {
      short: 220,
      medium: 320,
      long: 420,
    },
  };

  const curves = MOTION_CURVES[animationKey] ?? MOTION_CURVES.balanced;
  const baseDurations = MOTION_DURATIONS[animationKey] ?? MOTION_DURATIONS.balanced;
  const scaledDurations = Object.fromEntries(
    Object.entries(baseDurations).map(([key, value]) => [
      key,
      Math.max(0, Math.round(value * (multiplier ?? 0))),
    ])
  );

  const cssVars = {
    "--theme-motion-ease-standard": curves.standard,
    "--theme-motion-ease-emphasized": curves.emphasized,
    "--theme-motion-ease-entrance": curves.entrance,
    "--theme-motion-duration-short": `${scaledDurations.short}ms`,
    "--theme-motion-duration-medium": `${scaledDurations.medium}ms`,
    "--theme-motion-duration-long": `${scaledDurations.long}ms`,
  };

  return { curves, durations: scaledDurations, cssVars };
}

export function formatContrast(paletteHex) {
  const contrastReport = auditContrastRatios(paletteHex);
  return {
    report: contrastReport,
    formatted: formatContrastReport(contrastReport),
    failures: describeContrastFailures(contrastReport),
  };
}
