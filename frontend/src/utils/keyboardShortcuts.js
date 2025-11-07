import paths from "./paths";
import { useEffect } from "react";
import { userFromStorage } from "./request";
import { TOGGLE_LLM_SELECTOR_EVENT } from "@/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/action";

export const KEYBOARD_SHORTCUTS_HELP_EVENT = "keyboard-shortcuts-help";
const platform = typeof navigator !== "undefined" ? navigator.platform : "";
export const isMac = platform.toUpperCase().includes("MAC");

export const SHORTCUTS = {
  "⌘ + ,": {
    translationKey: "settings",
    category: "navigation",
    action: () => {
      window.location.href = paths.settings.interface();
    },
  },
  "⌘ + H": {
    translationKey: "home",
    category: "navigation",
    action: () => {
      window.location.href = paths.home();
    },
  },
  "⌘ + I": {
    translationKey: "workspaces",
    category: "navigation",
    action: () => {
      window.location.href = paths.settings.workspaces();
    },
  },
  "⌘ + K": {
    translationKey: "apiKeys",
    category: "navigation",
    action: () => {
      window.location.href = paths.settings.apiKeys();
    },
  },
  "⌘ + L": {
    translationKey: "llmPreferences",
    category: "workspace",
    action: () => {
      window.location.href = paths.settings.llmPreference();
    },
  },
  "⌘ + Shift + C": {
    translationKey: "chatSettings",
    category: "workspace",
    action: () => {
      window.location.href = paths.settings.chat();
    },
  },
  "⌘ + Shift + ?": {
    translationKey: "help",
    category: "utilities",
    action: () => {
      window.dispatchEvent(
        new CustomEvent(KEYBOARD_SHORTCUTS_HELP_EVENT, {
          detail: { show: true },
        })
      );
    },
  },
  F1: {
    translationKey: "help",
    category: "utilities",
    action: () => {
      window.dispatchEvent(
        new CustomEvent(KEYBOARD_SHORTCUTS_HELP_EVENT, {
          detail: { show: true },
        })
      );
    },
  },
  "⌘ + Shift + L": {
    translationKey: "showLLMSelector",
    category: "workspace",
    action: () => {
      window.dispatchEvent(new Event(TOGGLE_LLM_SELECTOR_EVENT));
    },
  },
};

export const WORKFLOW_GUIDES = [
  {
    id: "start-chat",
    translationKey: "startChat",
    href: paths.home(),
  },
  {
    id: "ingest-content",
    translationKey: "ingestContent",
    href: paths.settings.workspaces(),
  },
  {
    id: "publish-agent",
    translationKey: "publishAgent",
    href: paths.communityHub.trending(),
  },
];

const CATEGORY_ORDER = ["navigation", "workspace", "utilities"];

const LISTENERS = {};
const modifier = isMac ? "meta" : "ctrl";
for (const key in SHORTCUTS) {
  const listenerKey = key
    .replace("⌘", modifier)
    .replaceAll(" ", "")
    .toLowerCase();
  LISTENERS[listenerKey] = SHORTCUTS[key].action;
}

export function getShortcutGuide() {
  const groups = CATEGORY_ORDER.map((category) => ({
    id: category,
    shortcuts: [],
  }));

  Object.entries(SHORTCUTS).forEach(([combo, definition]) => {
    const group = groups.find((item) => item.id === definition.category);
    if (!group) return;
    group.shortcuts.push({
      combo,
      translationKey: definition.translationKey,
    });
  });

  return groups.filter((group) => group.shortcuts.length > 0);
}

function getShortcutKey(event) {
  let key = "";
  if (event.metaKey || event.ctrlKey) key += modifier + "+";
  if (event.shiftKey) key += "shift+";
  if (event.altKey) key += "alt+";

  if (event.key === ",") key += ",";
  else if (event.key === "?" || event.key === "/") key += "?";
  else if (event.key === "Control") return "";
  else if (event.key === "Shift") return "";
  else key += event.key.toLowerCase();
  return key;
}

export function initKeyboardShortcuts() {
  function handleKeyDown(event) {
    const shortcutKey = getShortcutKey(event);
    if (!shortcutKey) return;

    const action = LISTENERS[shortcutKey];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const user = userFromStorage();
    if (!!user && user?.role !== "admin") return;
    const cleanup = initKeyboardShortcuts();

    return () => cleanup();
  }, []);
  return;
}

export function KeyboardShortcutWrapper({ children }) {
  useKeyboardShortcuts();
  return children;
}
