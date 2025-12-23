import React from "react";

const steps = [
  { title: "Define goal", detail: "Summarize workspace docs" },
  { title: "Select tools", detail: "Search, summarizer, handoff" },
  { title: "Review prompts", detail: "Guardrails + style guide" },
];

export default {
  title: "Agent Builder/Scenarios",
  parameters: { layout: "fullscreen" },
};

export const OrchestrationPath = {
  render: () => (
    <div className="max-w-4xl mx-auto rounded-2xl border border-theme-home-border bg-theme-bg-primary p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-theme-text-secondary">Agent blueprint</p>
          <p className="text-lg font-semibold text-theme-text-primary">
            Summarizer with fallback handoff
          </p>
        </div>
        <span className="text-xs text-theme-text-secondary">Keyboard friendly</span>
      </header>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex items-start gap-3 rounded-xl border border-theme-home-border px-3 py-2"
          >
            <span className="h-6 w-6 rounded-full bg-theme-button-primary text-theme-button-text flex items-center justify-center text-xs font-semibold">
              {index + 1}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-theme-text-primary">{step.title}</span>
              <span className="text-xs text-theme-text-secondary">{step.detail}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  ),
};
