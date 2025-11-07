# Frontend Accessibility & Workflow Guide

AnythingLLM ships with a keyboard-accessible UI and contextual help so power users and new teammates can work efficiently. This
note documents the affordances that now exist in the production build and how to exercise them.

## Keyboard shortcuts

The shortcut modal (`⌘ + Shift + ?` or `F1`) is now accessible via a screen-reader friendly dialog that traps focus, announces
state changes, and restores the previously focused element when closed. Shortcuts are grouped by workflow category:

- **Navigation** — global routing actions such as jumping to Home or instance settings.
- **Workspace** — configuration shortcuts for chat preferences and the LLM selector.
- **Utilities** — contextual help and the command palette.

The helper exports live from `frontend/src/utils/keyboardShortcuts.js`, allowing components to render the metadata without
re-implementing the bindings. Use `getShortcutGuide()` to fetch the grouped definitions if you need to build auxiliary UIs.

## Workflow quick start panel

The shortcut modal includes a contextual "Workflow quick start" grid. Each tile links to a commonly requested flow (starting a
chat, ingesting content, or publishing an agent) and doubles as on-boarding guidance. Links are rendered with React Router
`<Link>` elements so navigation remains within the SPA.

## Accessibility helpers

The reusable helpers live under `frontend/src/utils/accessibility.js` and `frontend/src/hooks/useAccessibleModal.js`. They
cover:

- Focus management (collecting focusable elements, focusing the first interactive control, and trapping focus within modals).
- Screen-reader announcements via a shared live region.
- Automated contrast auditing, exposed through `auditContrastRatios` and surfaced in development builds via console tables.

Modal components should wrap their content with `ModalWrapper`, which now wires in the focus trap, escape key handling, and ARIA
attributes automatically.

## Theming tokens

Theme evaluation now generates procedural palettes and motion curves, exposing the results via `useTheme()` as:

- `proceduralPalette` — derived surfaces, overlays, and stronger accent colors.
- `motion` — easing curves and duration tokens that respect the reduced-motion media query and user density settings.
- `contrastReport` — the WCAG contrast audit for the active palette.

CSS custom properties for these tokens are available globally (see `frontend/src/index.css`). Tailwind classes such as
`bg-theme-surface-raised` and `border-theme-surface-border` map directly to the new variables.

## Implementation checklist

When building a new interactive flow:

1. Import `ModalWrapper` (for dialogs) or the raw helpers for bespoke components.
2. Run `auditContrastRatios` against any custom palettes and address failures before committing.
3. Surface the relevant workflow link inside the shortcut modal if the change adds a top-level entry point.
