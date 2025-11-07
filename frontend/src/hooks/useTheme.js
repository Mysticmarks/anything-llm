import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { REFETCH_LOGO_EVENT } from "@/LogoContext";
import Appearance from "@/models/appearance";
import { AUTH_USER } from "@/utils/constants";
import {
  auditContrastRatios,
  contrastRatio,
  describeContrastFailures,
  formatContrastReport,
} from "@/utils/accessibility";

const DENSITY_SCALE = {
  compact: 0.92,
  comfortable: 1,
  spacious: 1.1,
};

const ANIMATION_SCALE = {
  reduced: 0.7,
  balanced: 1,
  expressive: 1.25,
};

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

const PRESET_DEFINITIONS = {
  default: {
    name: "Midnight",
    mode: "dark",
    palette: {
      background: "#0e0f0f",
      surface: "#1b1b1e",
      sidebar: "#0e0f0f",
      chat: "#1b1b1e",
      accent: "#36bffa",
      accentMuted: "#22343f",
      text: "#ffffff",
      textMuted: "#9f9fa0",
      success: "#12b76a",
      warning: "#fec84b",
      danger: "#f97066",
      border: "#3f3f42",
    },
    typography: {
      fontFamily:
        "plus-jakarta-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
      scale: 1,
    },
    density: "comfortable",
    animation: "balanced",
  },
  light: {
    name: "Daybreak",
    mode: "light",
    palette: {
      background: "#ffffff",
      surface: "#f9fbfd",
      sidebar: "#edf2fa",
      chat: "#ffffff",
      accent: "#0ba5ec",
      accentMuted: "#dbe8fe",
      text: "#0e0f0f",
      textMuted: "#6f6f71",
      success: "#039855",
      warning: "#f79009",
      danger: "#d92d20",
      border: "#d3d4d4",
    },
    typography: {
      fontFamily:
        "'Inter', plus-jakarta-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
      scale: 1,
    },
    density: "comfortable",
    animation: "balanced",
  },
  aurora: {
    name: "Aurora",
    mode: "dark",
    palette: {
      background: "#12131d",
      surface: "#1a1d2a",
      sidebar: "#10121c",
      chat: "#181a25",
      accent: "#7dd3fc",
      accentMuted: "#23344a",
      text: "#f3f9ff",
      textMuted: "#a5c3e6",
      success: "#22c55e",
      warning: "#fbbf24",
      danger: "#fb7185",
      border: "#2b364c",
    },
    typography: {
      fontFamily:
        "'Rubik', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
      scale: 1.02,
    },
    density: "comfortable",
    animation: "expressive",
  },
  forest: {
    name: "Evergreen",
    mode: "dark",
    palette: {
      background: "#101a12",
      surface: "#162418",
      sidebar: "#0c1b0f",
      chat: "#162e1d",
      accent: "#4ade80",
      accentMuted: "#20402c",
      text: "#f0fff4",
      textMuted: "#bfe9cd",
      success: "#4ade80",
      warning: "#facc15",
      danger: "#f87171",
      border: "#23482d",
    },
    typography: {
      fontFamily:
        "'Public Sans', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
      scale: 1,
    },
    density: "compact",
    animation: "reduced",
  },
  sunset: {
    name: "Sunset",
    mode: "dark",
    palette: {
      background: "#1b1417",
      surface: "#271d25",
      sidebar: "#1a141e",
      chat: "#241721",
      accent: "#ff7ab6",
      accentMuted: "#402033",
      text: "#ffe6f0",
      textMuted: "#f0bcd0",
      success: "#f9a8d4",
      warning: "#f9db6d",
      danger: "#ff8f70",
      border: "#4b293a",
    },
    typography: {
      fontFamily:
        "'DM Sans', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
      scale: 1.04,
    },
    density: "spacious",
    animation: "expressive",
  },
};

const THEME_PRESETS = Object.fromEntries(
  Object.entries(PRESET_DEFINITIONS).map(([key, config]) => [
    key,
    {
      id: key,
      name: config.name,
      mode: config.mode,
      palette: convertHexPaletteToHsv(config.palette),
      typography: config.typography,
      density: config.density,
      animation: config.animation,
    },
  ])
);

function detectReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resolveUserKey() {
  if (typeof window === "undefined") return "guest";
  try {
    const storedUser = window.localStorage.getItem(AUTH_USER);
    if (!storedUser) return "guest";
    const parsed = JSON.parse(storedUser);
    if (parsed?.id) return String(parsed.id);
    if (parsed?.uuid) return String(parsed.uuid);
    return "guest";
  } catch (error) {
    console.error("Failed to resolve user key from storage:", error);
    return "guest";
  }
}

function detectSystemPreset() {
  if (typeof window === "undefined" || !window.matchMedia) return "default";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "default";
}

function clonePalette(palette) {
  return Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [key, { ...value }])
  );
}

function mergePalette(target = {}, fallback = {}) {
  return Object.fromEntries(
    Object.entries(fallback).map(([key, base]) => {
      const candidate = target[key] || base;
      return [
        key,
        {
          h: clamp(numberOrFallback(candidate.h, base.h), 0, 360),
          s: clamp(numberOrFallback(candidate.s, base.s), 0, 100),
          v: clamp(numberOrFallback(candidate.v, base.v), 0, 100),
        },
      ];
    })
  );
}

function numberOrFallback(value, fallback) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function createPresetState(presetKey) {
  const preset = THEME_PRESETS[presetKey] ?? THEME_PRESETS.default;
  return {
    activePreset: presetKey,
    basePreset: presetKey,
    palette: clonePalette(preset.palette),
    basePalette: clonePalette(preset.palette),
    typography: { ...preset.typography },
    density: preset.density,
    animation: preset.animation,
    isCustom: false,
  };
}

function sanitizeThemeState(rawState) {
  if (!rawState) {
    return createPresetState(detectSystemPreset());
  }

  const potentialBasePreset = rawState.basePreset || rawState.activePreset;
  const basePresetKey = THEME_PRESETS[potentialBasePreset]
    ? potentialBasePreset
    : detectSystemPreset();
  const defaultState = createPresetState(basePresetKey);

  const typographyScale = clamp(
    numberOrFallback(
      rawState?.typography?.scale,
      defaultState.typography.scale
    ),
    0.85,
    1.2
  );

  return {
    ...defaultState,
    activePreset: rawState.isCustom ? "custom" : defaultState.activePreset,
    basePreset: basePresetKey,
    palette: mergePalette(rawState.palette, defaultState.palette),
    basePalette: mergePalette(rawState.basePalette, defaultState.basePalette),
    typography: {
      ...defaultState.typography,
      ...(rawState.typography || {}),
      scale: typographyScale,
    },
    density: rawState.density || defaultState.density,
    animation: rawState.animation || defaultState.animation,
    isCustom: Boolean(rawState.isCustom),
  };
}

function loadTheme(userKey) {
  let stored = null;
  try {
    stored = Appearance.getSettings()?.themePreferences?.[userKey] ?? null;
  } catch (error) {
    console.error(
      "Failed to read theme preferences from Appearance settings:",
      error
    );
  }

  if (!stored && typeof window !== "undefined") {
    try {
      const legacy = window.localStorage.getItem(
        `anythingllm_theme_${userKey}`
      );
      stored = legacy ? JSON.parse(legacy) : null;
    } catch (error) {
      console.error("Failed to read legacy theme preferences:", error);
    }
  }

  return sanitizeThemeState(stored);
}

function hsvToHex({ h, s, v }) {
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

function hexToRgb(hex) {
  const sanitized = hex.replace("#", "");
  const bigint = parseInt(sanitized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => {
      const clamped = clamp(Math.round(value), 0, 255).toString(16);
      return clamped.length === 1 ? `0${clamped}` : clamped;
    })
    .join("")}`;
}

function hexToHsv(hex) {
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

function convertHexPaletteToHsv(hexPalette) {
  return Object.fromEntries(
    Object.entries(hexPalette).map(([key, value]) => [key, hexToHsv(value)])
  );
}

function convertPaletteToHex(palette) {
  return Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [key, hsvToHex(value)])
  );
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function mix(hexA, hexB, weight = 0.5) {
  const { r: r1, g: g1, b: b1 } = hexToRgb(hexA);
  const { r: r2, g: g2, b: b2 } = hexToRgb(hexB);
  const w = clamp(weight, 0, 1);
  const r = r1 * (1 - w) + r2 * w;
  const g = g1 * (1 - w) + g2 * w;
  const b = b1 * (1 - w) + b2 * w;
  return rgbToHex(r, g, b);
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function adjustValue(hex, delta) {
  const hsv = hexToHsv(hex);
  return hsvToHex({ ...hsv, v: clamp(hsv.v + delta, 0, 100) });
}

function adjustSaturation(hex, delta) {
  const hsv = hexToHsv(hex);
  return hsvToHex({ ...hsv, s: clamp(hsv.s + delta, 0, 100) });
}

function computeModeFromPalette(paletteHex) {
  const { r, g, b } = hexToRgb(paletteHex.background);
  const luminance =
    0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return luminance > 0.6 ? "light" : "dark";
}

function deriveCssVariables(paletteHex) {
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
    "--theme-sidebar-footer-icon-hover": withAlpha(textPrimary, 0.4),
    "--theme-chat-input-border": mix(border, surface, 0.6),
    "--theme-action-menu-bg": menuBg,
    "--theme-action-menu-item-hover": withAlpha(hoverAccent, 0.35),
    "--theme-settings-input-bg": elevated,
    "--theme-settings-input-placeholder": placeholder,
    "--theme-settings-input-active": withAlpha(accent, 0.2),
    "--theme-settings-input-text": textPrimary,
    "--theme-modal-border": withAlpha(border, 0.8),
    "--theme-button-primary": accent,
    "--theme-button-primary-hover": adjustSaturation(accent, -10),
    "--theme-button-cta": adjustValue(accent, 8),
    "--theme-file-row-even": elevated,
    "--theme-file-row-odd": mix(elevated, surface, 0.5),
    "--theme-file-row-selected-even": withAlpha(accent, 0.25),
    "--theme-file-row-selected-odd": withAlpha(accent, 0.35),
    "--theme-file-picker-hover": withAlpha(accent, 0.2),
    "--theme-home-text": textPrimary,
    "--theme-home-text-secondary": textSecondary,
    "--theme-home-bg-card": surface,
    "--theme-home-bg-button": buttonSecondary,
    "--theme-home-border": withAlpha(border, 0.5),
    "--theme-home-button-primary": accent,
    "--theme-home-button-primary-hover": adjustValue(accent, 4),
    "--theme-home-button-secondary": buttonSecondary,
    "--theme-home-button-secondary-hover": hoverAccent,
    "--theme-home-button-secondary-text": textPrimary,
    "--theme-home-button-secondary-hover-text": textPrimary,
    "--theme-home-update-card-bg": elevated,
    "--theme-home-update-card-hover": hoverAccent,
    "--theme-home-update-source": accent,
    "--theme-home-button-secondary-border": withAlpha(accent, 0.4),
    "--theme-home-button-secondary-border-hover": withAlpha(accent, 0.5),
    "--theme-checklist-item-bg": checklistHover,
    "--theme-checklist-item-bg-hover": adjustValue(checklistHover, 8),
    "--theme-checklist-item-text": textPrimary,
    "--theme-checklist-item-completed-bg": mix(success, surface, 0.4),
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

function buildProceduralPalette(paletteHex) {
  const accentContrastColor =
    contrastRatio(paletteHex.accent, "#000000") >= 4.5 ? "#000000" : "#ffffff";

  const tokens = {
    surfaceRaised: mix(paletteHex.surface, paletteHex.background, 0.35),
    surfaceSunken: mix(paletteHex.surface, paletteHex.background, 0.15),
    surfaceBorder: withAlpha(paletteHex.border, 0.55),
    borderStrong: mix(paletteHex.border, paletteHex.text, 0.25),
    accentStrong: adjustValue(paletteHex.accent, 6),
    accentMuted: withAlpha(paletteHex.accent, 0.18),
    accentContrast: accentContrastColor,
    overlaySoft: withAlpha(paletteHex.background, 0.6),
    overlayStrong: withAlpha(paletteHex.background, 0.8),
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

function resolveAnimationTokens(animationKey, multiplier = 1) {
  const curves = MOTION_CURVES[animationKey] ?? MOTION_CURVES.balanced;
  const baseDurations =
    MOTION_DURATIONS[animationKey] ?? MOTION_DURATIONS.balanced;
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

function persistThemeToAppearance(userKey, themeState) {
  try {
    const existing = Appearance.getSettings();
    const priorThemes = existing?.themePreferences || {};
    Appearance.updateSettings({
      themePreferences: {
        ...priorThemes,
        [userKey]: themeState,
      },
    });
  } catch (error) {
    console.error("Failed to persist theme preferences:", error);
  }
}

export function useTheme() {
  const userKey = useMemo(() => resolveUserKey(), []);
  const [themeState, setThemeState] = useState(() => loadTheme(userKey));
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    detectReducedMotion()
  );
  const paletteHex = useMemo(
    () => convertPaletteToHex(themeState.palette),
    [themeState.palette]
  );
  const themeMode = useMemo(
    () => computeModeFromPalette(paletteHex),
    [paletteHex]
  );

  const availableThemes = useMemo(() => {
    const presets = Object.entries(THEME_PRESETS).map(([id, config]) => ({
      id,
      label: config.name,
      mode: config.mode,
    }));
    if (
      themeState.isCustom &&
      !presets.find((preset) => preset.id === "custom")
    ) {
      presets.push({ id: "custom", label: "Custom", mode: themeMode });
    }
    return presets;
  }, [themeState.isCustom, themeMode]);

  const animationMultiplier = useMemo(() => {
    if (prefersReducedMotion) return 0;
    return ANIMATION_SCALE[themeState.animation] ?? 1;
  }, [prefersReducedMotion, themeState.animation]);

  const procedural = useMemo(
    () => buildProceduralPalette(paletteHex),
    [paletteHex]
  );

  const animationTokens = useMemo(
    () => resolveAnimationTokens(themeState.animation, animationMultiplier),
    [themeState.animation, animationMultiplier]
  );

  const contrastReport = useMemo(
    () => auditContrastRatios(paletteHex),
    [paletteHex]
  );

  const contrastTable = useMemo(
    () => formatContrastReport(contrastReport),
    [contrastReport]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event) => setPrefersReducedMotion(event.matches);
    try {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    } catch (error) {
      media.onchange = handler;
      return () => {
        media.onchange = null;
      };
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!contrastReport || contrastReport.passed) return;
    console.groupCollapsed("[theme] contrast issues detected");
    console.table(contrastTable);
    console.info(describeContrastFailures(contrastReport));
    console.groupEnd();
  }, [contrastReport, contrastTable]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const cssVars = deriveCssVariables(paletteHex);

    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    Object.entries(procedural.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    Object.entries(animationTokens.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.style.setProperty(
      "--theme-font-scale",
      `${clamp(themeState.typography.scale, 0.85, 1.2)}`
    );
    root.style.setProperty(
      "--theme-font-family",
      themeState.typography.fontFamily
    );
    root.style.setProperty(
      "--theme-density-factor",
      `${DENSITY_SCALE[themeState.density] ?? 1}`
    );
    root.style.setProperty(
      "--theme-animation-multiplier",
      `${animationMultiplier}`
    );

    document.documentElement.setAttribute(
      "data-theme",
      themeMode === "light" ? "light" : "default"
    );
    document.body.classList.toggle("light", themeMode === "light");

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          `anythingllm_theme_${userKey}`,
          JSON.stringify(themeState)
        );
      } catch (error) {
        console.error("Failed to persist theme preferences locally:", error);
      }
    }

    persistThemeToAppearance(userKey, themeState);
  }, [
    themeState,
    paletteHex,
    themeMode,
    userKey,
    animationMultiplier,
    animationTokens,
    procedural,
  ]);

  const previousMode = useRef(themeMode);
  useEffect(() => {
    if (previousMode.current !== themeMode) {
      window.dispatchEvent(new Event(REFETCH_LOGO_EVENT));
      previousMode.current = themeMode;
    }
  }, [themeMode]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    function toggleOnKeybind(event) {
      if (event.metaKey && event.key === ".") {
        event.preventDefault();
        setThemeState((prev) =>
          prev.basePreset === "light"
            ? createPresetState("default")
            : createPresetState("light")
        );
      }
    }
    document.addEventListener("keydown", toggleOnKeybind);
    return () => document.removeEventListener("keydown", toggleOnKeybind);
  }, []);

  const setTheme = useCallback((presetKey) => {
    if (presetKey === "custom") {
      setThemeState((prev) => ({
        ...prev,
        activePreset: "custom",
        isCustom: true,
      }));
      return;
    }

    setThemeState(createPresetState(presetKey));
  }, []);

  const updatePaletteColor = useCallback((role, channel, value) => {
    if (!role || !["h", "s", "v"].includes(channel)) return;
    setThemeState((prev) => {
      if (!prev.palette[role]) return prev;
      const max = channel === "h" ? 360 : 100;
      const nextPalette = {
        ...prev.palette,
        [role]: {
          ...prev.palette[role],
          [channel]: clamp(Number(value), 0, max),
        },
      };
      return {
        ...prev,
        palette: nextPalette,
        activePreset: "custom",
        isCustom: true,
      };
    });
  }, []);

  const resetPaletteColor = useCallback((role) => {
    setThemeState((prev) => {
      if (!role) {
        return {
          ...prev,
          palette: clonePalette(prev.basePalette),
          activePreset: prev.isCustom ? "custom" : prev.basePreset,
        };
      }
      if (!prev.palette[role] || !prev.basePalette[role]) return prev;
      return {
        ...prev,
        palette: {
          ...prev.palette,
          [role]: { ...prev.basePalette[role] },
        },
        activePreset: "custom",
        isCustom: true,
      };
    });
  }, []);

  const resetTheme = useCallback(() => {
    setThemeState((prev) => createPresetState(prev.basePreset));
  }, []);

  const setTypography = useCallback((updates) => {
    setThemeState((prev) => ({
      ...prev,
      typography: {
        fontFamily: updates.fontFamily || prev.typography.fontFamily,
        scale: clamp(
          typeof updates.scale === "number"
            ? updates.scale
            : prev.typography.scale,
          0.85,
          1.2
        ),
      },
      activePreset: "custom",
      isCustom: true,
    }));
  }, []);

  const setDensity = useCallback((density) => {
    if (!DENSITY_SCALE[density]) return;
    setThemeState((prev) => ({
      ...prev,
      density,
      activePreset: "custom",
      isCustom: true,
    }));
  }, []);

  const setAnimation = useCallback((animation) => {
    if (!ANIMATION_SCALE[animation]) return;
    setThemeState((prev) => ({
      ...prev,
      animation,
      activePreset: "custom",
      isCustom: true,
    }));
  }, []);

  return {
    theme: themeState.activePreset,
    themeMode,
    availableThemes,
    setTheme,
    palette: paletteHex,
    paletteHsv: themeState.palette,
    updatePaletteColor,
    resetPaletteColor,
    resetTheme,
    typography: themeState.typography,
    setTypography,
    density: themeState.density,
    setDensity,
    animation: themeState.animation,
    setAnimation,
    animationMultiplier,
    proceduralPalette: procedural.tokens,
    motion: {
      easing: animationTokens.curves,
      durations: animationTokens.durations,
      multiplier: animationMultiplier,
    },
    contrastReport,
    contrastSummary: contrastTable,
    isCustomTheme: themeState.isCustom,
    basePreset: themeState.basePreset,
  };
}
