import React from "react";
import "../src/index.css";
import { ThemeProvider } from "../src/ThemeContext";

export const decorators = [
  (Story) => (
    <ThemeProvider>
      <div className="min-h-screen bg-theme-bg-secondary text-theme-text-primary p-6">
        <Story />
      </div>
    </ThemeProvider>
  ),
];

export const parameters = {
  controls: { expanded: true },
  a11y: { element: "#root" },
  layout: "fullscreen",
};
