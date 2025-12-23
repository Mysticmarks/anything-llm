import React from "react";

const tiles = [
  { title: "Workspace uptime", value: "99.9%", detail: "last 7d" },
  { title: "Active agents", value: "12", detail: "builder coverage" },
  { title: "Conversations", value: "4.2k", detail: "monthly" },
  { title: "Avg. response", value: "1.4s", detail: "p75" },
];

export default {
  title: "Dashboards/Workspace",
  parameters: { layout: "fullscreen" },
};

export const WorkspaceHealth = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.title}
          className="rounded-xl border border-theme-home-border bg-theme-bg-primary p-4 shadow-sm"
          aria-label={`${tile.title} tile`}
        >
          <p className="text-xs uppercase tracking-wide text-theme-text-secondary">
            {tile.title}
          </p>
          <p className="text-2xl font-semibold text-theme-text-primary">{tile.value}</p>
          <p className="text-xs text-theme-text-secondary">{tile.detail}</p>
        </div>
      ))}
    </div>
  ),
};
