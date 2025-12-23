import React from "react";
import { useTheme } from "@/hooks/useTheme";

function PaletteSwatches() {
  const { themeMode, palette, proceduralPalette, contrastSummary } = useTheme();
  const rows = Object.entries(palette);
  const proceduralRows = Object.entries(proceduralPalette);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-theme-home-border bg-theme-bg-primary p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold uppercase text-theme-text-secondary">
            Base palette
          </h3>
          <span className="text-xs text-theme-text-secondary">Mode: {themeMode}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {rows.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-lg border border-theme-home-border p-3"
            >
              <span
                className="h-8 w-8 rounded-md border border-theme-home-border"
                style={{ backgroundColor: value }}
                aria-label={`${key} swatch`}
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-theme-text-primary capitalize">
                  {key}
                </span>
                <span className="text-xs text-theme-text-secondary">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-theme-home-border bg-theme-bg-primary p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold uppercase text-theme-text-secondary">
            Procedural tokens
          </h3>
          <span className="text-xs text-theme-text-secondary">Contrast: {contrastSummary?.length || 0} pairs</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {proceduralRows.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-lg border border-theme-home-border p-3"
            >
              <span
                className="h-8 w-8 rounded-md border border-theme-home-border"
                style={{ backgroundColor: value }}
                aria-label={`${key} token`}
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-theme-text-primary capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className="text-xs text-theme-text-secondary">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default {
  title: "Design/Theming",
  parameters: {
    layout: "fullscreen",
  },
};

export const DarkModeTokens = {
  render: () => <PaletteSwatches />,
};
