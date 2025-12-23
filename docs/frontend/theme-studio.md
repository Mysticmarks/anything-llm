# Theme Studio Reference

Theme Studio is the dark-mode-first design surface for AnythingLLM. It exposes every palette channel, procedural overlays, and motion density settings while persisting user-level preferences.

## Interaction model

- Palette sliders edit HSV channels for each token (background, surface, sidebar, chat, accent, text, text-muted, success, warning, danger, border). Values are clamped to safe ranges and stored with the active preset.
- Procedural controls let designers bias overlays toward darker backgrounds, boost accent saturation, and tune overlay opacity. Inputs are validated before persisting and resettable to defaults from the card header.
- Typography, density, and motion selectors immediately reflow previews; presets can be swapped or reset without losing custom palettes.

## Default palettes

Five presets ship with Theme Studio:

- **Midnight** (dark) — charcoal surfaces with cyan accents for high contrast defaults.
- **Daybreak** (light) — bright backgrounds, cool blues, and warm semantic colors.
- **Aurora** (dark) — indigo gradients with frosty text and expressive motion.
- **Evergreen** (dark) — forest greens with compact density and reduced motion.
- **Sunset** (dark) — magenta/orange accents with spacious typography.

All presets seed CSS custom properties, procedural overlays, and animation tokens. The system falls back to the light preset when the OS prefers light mode.

## Accessibility targets

- Text and accent foregrounds must maintain a 4.5:1 contrast ratio against background and surface tokens; failing pairs are logged in development builds.
- Motion respects `prefers-reduced-motion` and allows Reduced/Balanced/Expressive tuning without overriding user media settings.
- Keyboard users can tab through preset selection, palette sliders, procedural controls, typography, density, and motion inputs in document order.

## Storybook and visual regression

Storybook runs from the `frontend/.storybook` config with Vite. Stories cover theming tokens, chat UI, workspace dashboards, and agent builder scaffolds. Visual regression snapshots are captured via the Storybook test runner after visiting the four canonical stories.

Commands (run from `frontend/`):

- `yarn storybook` — launch the Storybook dev server at port 6006.
- `yarn storybook:build` — emit the static Storybook bundle.
- `yarn storybook:test` — run the Storybook test runner and generate snapshot baselines for tracked stories.

## Palette generation and persistence

Procedural palette generation favors dark overlays by default, adjusts accent saturation for stronger call-to-actions, and scales overlay opacity for dialogs and sidebars. Inputs are validated on change before being saved to `Appearance.themePreferences`, so broken values cannot be persisted. Preferences are keyed per user and mirrored to `localStorage` for offline startup.
