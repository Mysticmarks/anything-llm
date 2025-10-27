import { useMemo } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import { useTheme } from "@/hooks/useTheme";
import { motion } from "framer-motion";

const COLOR_CHANNELS = [
  { key: "h", label: "Hue", min: 0, max: 360 },
  { key: "s", label: "Saturation", min: 0, max: 100 },
  { key: "v", label: "Value", min: 0, max: 100 },
];

const COLOR_LABELS = {
  background: "Background",
  surface: "Surface",
  sidebar: "Sidebar",
  chat: "Chat Canvas",
  accent: "Primary Accent",
  accentMuted: "Muted Accent",
  text: "Primary Text",
  textMuted: "Secondary Text",
  success: "Success",
  warning: "Warning",
  danger: "Danger",
  border: "Border",
};

const COLOR_KEYS = Object.keys(COLOR_LABELS);

const DENSITY_OPTIONS = [
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious", label: "Spacious" },
];

const FONT_OPTIONS = [
  {
    id: "plus-jakarta",
    label: "Plus Jakarta Sans",
    value:
      "plus-jakarta-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  {
    id: "inter",
    label: "Inter",
    value:
      "'Inter', plus-jakarta-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  {
    id: "rubik",
    label: "Rubik",
    value:
      "'Rubik', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  {
    id: "public-sans",
    label: "Public Sans",
    value:
      "'Public Sans', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    value:
      "'DM Sans', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  {
    id: "system",
    label: "System Default",
    value:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
];

const ANIMATION_OPTIONS = [
  { id: "reduced", label: "Reduced" },
  { id: "balanced", label: "Balanced" },
  { id: "expressive", label: "Expressive" },
];

const DENSITY_SCALE = {
  compact: 0.92,
  comfortable: 1,
  spacious: 1.1,
};

export default function ThemeStudio() {
  const {
    theme,
    themeMode,
    availableThemes,
    setTheme,
    palette,
    paletteHsv,
    updatePaletteColor,
    resetPaletteColor,
    resetTheme,
    typography,
    setTypography,
    density,
    setDensity,
    animation,
    setAnimation,
    animationMultiplier,
  } = useTheme();

  const previewDensity = DENSITY_SCALE[density] ?? 1;
  const previewFontScale = typography.scale ?? 1;

  const previewCardStyles = useMemo(
    () => ({
      padding: `${Math.round(20 * previewDensity)}px`,
      gap: `${Math.round(12 * previewDensity)}px`,
      fontFamily: typography.fontFamily,
      fontSize: `${Math.round(16 * previewFontScale)}px`,
      lineHeight: 1.5,
    }),
    [previewDensity, previewFontScale, typography.fontFamily]
  );

  const motionInteractions = useMemo(() => {
    if (!animationMultiplier) return {};
    return {
      whileHover: { scale: 1.02 },
      transition: { duration: 0.22 * animationMultiplier, ease: "easeOut" },
    };
  }, [animationMultiplier]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-auto"
      >
        <div className="flex flex-col w-full px-4 md:px-12 py-10 gap-8">
          <header className="flex flex-col gap-2 border-b border-theme-modal-border pb-4">
            <p className="text-lg font-bold text-theme-text-primary">
              Theme Studio
            </p>
            <p className="text-sm text-theme-text-secondary max-w-3xl">
              Craft bespoke color palettes, typography, and motion that match
              your brand. Adjust sliders to see live previews and save per-user
              preferences instantly.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <label className="text-xs uppercase tracking-wide text-theme-text-secondary">
                Preset
              </label>
              <select
                aria-label="Select theme preset"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="border-none bg-theme-settings-input-bg text-theme-settings-input-text text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none py-2 px-3"
              >
                {availableThemes.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => resetTheme()}
                className="rounded-lg border border-theme-home-button-secondary-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-theme-home-text hover:border-theme-home-button-secondary-border-hover"
              >
                Reset to Preset Defaults
              </button>
              <span className="ml-auto text-xs uppercase tracking-wider text-theme-text-secondary">
                Mode: {themeMode === "light" ? "Light" : "Dark"}
              </span>
            </div>
          </header>

          <section className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8">
            <div className="rounded-xl border border-theme-home-border bg-theme-bg-primary p-6">
              <h2 className="text-sm font-semibold uppercase text-theme-text-secondary">
                Palette
              </h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {COLOR_KEYS.map((key) => (
                  <ColorEditor
                    key={key}
                    colorKey={key}
                    label={COLOR_LABELS[key]}
                    colorHex={palette[key]}
                    hsv={paletteHsv[key]}
                    onChange={updatePaletteColor}
                    onReset={() => resetPaletteColor(key)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-xl border border-theme-home-border bg-theme-bg-primary p-6 flex flex-col gap-3">
                <h2 className="text-sm font-semibold uppercase text-theme-text-secondary">
                  Typography
                </h2>
                <label
                  className="text-xs text-theme-text-secondary"
                  htmlFor="font-family-select"
                >
                  Font family
                </label>
                <select
                  id="font-family-select"
                  value={typography.fontFamily}
                  onChange={(e) =>
                    setTypography({ fontFamily: e.target.value })
                  }
                  className="border-none bg-theme-settings-input-bg text-theme-settings-input-text text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none py-2 px-3"
                >
                  {FONT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label
                  className="text-xs text-theme-text-secondary"
                  htmlFor="font-scale"
                >
                  Type scale ({previewFontScale.toFixed(2)}x)
                </label>
                <input
                  id="font-scale"
                  type="range"
                  min="0.85"
                  max="1.2"
                  step="0.01"
                  value={previewFontScale}
                  onChange={(e) =>
                    setTypography({ scale: Number(e.target.value) })
                  }
                  className="w-full accent-theme-button-primary"
                />
              </div>

              <div className="rounded-xl border border-theme-home-border bg-theme-bg-primary p-6 flex flex-col gap-3">
                <h2 className="text-sm font-semibold uppercase text-theme-text-secondary">
                  Layout Density
                </h2>
                <div className="flex gap-2 flex-wrap">
                  {DENSITY_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDensity(option.id)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-200 ${
                        density === option.id
                          ? "border-theme-button-primary text-theme-text-primary"
                          : "border-theme-home-border text-theme-text-secondary hover:border-theme-button-primary/60"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-theme-home-border bg-theme-bg-primary p-6 flex flex-col gap-3">
                <h2 className="text-sm font-semibold uppercase text-theme-text-secondary">
                  Motion
                </h2>
                <p className="text-xs text-theme-text-secondary">
                  Choose how interactive elements animate. Expressive motion
                  feels lively, while reduced motion supports accessibility
                  needs.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {ANIMATION_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAnimation(option.id)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-200 ${
                        animation === option.id
                          ? "border-theme-button-primary text-theme-text-primary"
                          : "border-theme-home-border text-theme-text-secondary hover:border-theme-button-primary/60"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              className="rounded-2xl border border-theme-home-border bg-theme-bg-primary shadow-lg"
              style={previewCardStyles}
              {...motionInteractions}
            >
              <h3 className="text-theme-text-primary font-semibold text-base">
                Interface Preview
              </h3>
              <p className="text-theme-text-secondary text-sm">
                Buttons, cards, and inputs respond with motion tuned to your
                preferences.
              </p>
              <motion.button
                type="button"
                className="self-start rounded-lg bg-theme-button-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-theme-button-text"
                whileHover={animationMultiplier ? { scale: 1.05 } : undefined}
                transition={{
                  duration: 0.18 * (animationMultiplier || 1),
                  ease: "easeOut",
                }}
              >
                Hover me
              </motion.button>
              <div className="flex flex-col gap-2 mt-4">
                {[
                  "Adaptive typography",
                  "Responsive density",
                  "Accessible motion",
                ].map((item) => (
                  <motion.div
                    key={item}
                    className="flex items-center gap-3 rounded-lg border border-theme-home-border px-3 py-2"
                    whileHover={animationMultiplier ? { x: 4 } : undefined}
                    transition={{
                      duration: 0.2 * (animationMultiplier || 1),
                      ease: "easeOut",
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full bg-theme-button-primary"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-theme-text-primary">
                      {item}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="rounded-2xl border border-theme-home-border bg-theme-bg-primary p-5 flex flex-col gap-3"
              animate={
                animationMultiplier
                  ? {
                      boxShadow: [
                        "0 0 0 rgba(0,0,0,0)",
                        "0 16px 32px rgba(0,0,0,0.25)",
                        "0 0 0 rgba(0,0,0,0)",
                      ],
                    }
                  : undefined
              }
              transition={{
                duration: 2.6 * (animationMultiplier || 1),
                repeat: animationMultiplier ? Infinity : 0,
                ease: "easeInOut",
              }}
            >
              <h3 className="text-theme-text-primary font-semibold text-base">
                Chat Bubble Preview
              </h3>
              <div className="flex flex-col gap-3">
                <motion.div
                  className="self-start max-w-xs rounded-2xl bg-theme-bg-chat px-4 py-3 text-sm text-theme-text-primary"
                  whileHover={animationMultiplier ? { scale: 1.03 } : undefined}
                  transition={{
                    duration: 0.18 * (animationMultiplier || 1),
                    ease: "easeOut",
                  }}
                >
                  Hi there! Adjust colors and motion to make AnythingLLM feel
                  like home.
                </motion.div>
                <motion.div
                  className="self-end max-w-xs rounded-2xl bg-theme-button-primary/20 px-4 py-3 text-sm text-theme-text-primary"
                  whileHover={animationMultiplier ? { scale: 1.03 } : undefined}
                  transition={{
                    duration: 0.18 * (animationMultiplier || 1),
                    ease: "easeOut",
                  }}
                >
                  Palette updates propagate instantly thanks to CSS custom
                  properties.
                </motion.div>
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ColorEditor({ colorKey, label, colorHex, hsv, onChange, onReset }) {
  return (
    <div className="rounded-xl border border-theme-home-border bg-theme-bg-primary p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-md border border-theme-home-border"
            style={{ backgroundColor: colorHex }}
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-theme-text-primary">
              {label}
            </span>
            <span className="text-xs text-theme-text-secondary uppercase tracking-wide">
              {colorHex}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold uppercase tracking-wide text-theme-text-secondary hover:text-theme-button-primary"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {COLOR_CHANNELS.map((channel) => (
          <label
            key={`${colorKey}-${channel.key}`}
            className="flex flex-col text-xs text-theme-text-secondary gap-1"
          >
            <span>
              {channel.label}: {Math.round(hsv?.[channel.key] ?? 0)}
            </span>
            <input
              type="range"
              min={channel.min}
              max={channel.max}
              step={channel.key === "h" ? 1 : 0.5}
              value={hsv?.[channel.key] ?? 0}
              onChange={(event) =>
                onChange(colorKey, channel.key, Number(event.target.value))
              }
              aria-label={`${label} ${channel.label}`}
              className="w-full accent-theme-button-primary"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
