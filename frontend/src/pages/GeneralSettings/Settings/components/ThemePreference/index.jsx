import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";

export default function ThemePreference() {
  const { t } = useTranslation();
  const { theme, setTheme, availableThemes, palette } = useTheme();
  const previewSwatches = Object.entries(palette)
    .slice(0, 5)
    .map(([key, value]) => ({ key, value }));

  return (
    <div className="flex flex-col gap-y-0.5 my-4">
      <p className="text-sm leading-6 font-semibold text-white">
        {t("customization.items.theme.title")}
      </p>
      <p className="text-xs text-white/60">
        {t("customization.items.theme.description")}
      </p>
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-x-4 mt-2">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full md:w-fit py-2 px-4"
        >
          {availableThemes.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <Link
          to={paths.settings.themeStudio()}
          className="inline-flex items-center justify-center rounded-lg border border-theme-home-button-secondary-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-theme-home-text transition-colors duration-200 hover:border-theme-home-button-secondary-border-hover hover:bg-theme-home-button-secondary-hover"
        >
          {t("customization.items.theme.open_studio", "Open Theme Studio")}
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-2" aria-hidden="true">
        {previewSwatches.map((swatch) => (
          <div
            key={swatch.key}
            className="h-6 w-6 rounded-md border border-theme-home-border"
            style={{ backgroundColor: swatch.value }}
          />
        ))}
      </div>
    </div>
  );
}
