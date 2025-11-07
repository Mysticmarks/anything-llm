import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X, ArrowCircleUpRight } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import ModalWrapper from "@/components/ModalWrapper";
import {
  KEYBOARD_SHORTCUTS_HELP_EVENT,
  getShortcutGuide,
  isMac,
  WORKFLOW_GUIDES,
} from "@/utils/keyboardShortcuts";

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const sections = useMemo(() => getShortcutGuide(), []);
  const formatCombo = useCallback((combo) => {
    if (isMac) return combo;
    return combo.replaceAll("⌘", "Ctrl");
  }, []);

  useEffect(() => {
    function handleToggle(event) {
      const shouldShow = event?.detail?.show;
      if (typeof shouldShow === "boolean") {
        setIsOpen(shouldShow);
        return;
      }
      setIsOpen((prev) => !prev);
    }

    window.addEventListener(KEYBOARD_SHORTCUTS_HELP_EVENT, handleToggle);
    return () => {
      window.removeEventListener(KEYBOARD_SHORTCUTS_HELP_EVENT, handleToggle);
    };
  }, []);

  const closeModal = useCallback(() => setIsOpen(false), []);

  if (!isOpen) return null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={closeModal}
      label={t("keyboard-shortcuts.title")}
      labelledBy="keyboard-shortcuts-heading"
    >
      <div className="relative bg-theme-bg-secondary rounded-lg p-6 max-w-3xl w-full mx-4 shadow-xl border border-theme-modal-border">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2
              id="keyboard-shortcuts-heading"
              className="text-xl font-semibold text-theme-text-primary"
            >
              {t("keyboard-shortcuts.title")}
            </h2>
            <p className="mt-2 text-sm text-theme-text-secondary">
              {t("keyboard-shortcuts.intro")}
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="text-theme-text-secondary hover:text-theme-text-primary transition-colors"
            aria-label={t("keyboard-shortcuts.close")}
          >
            <X size={22} weight="bold" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" role="presentation">
          {sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`keyboard-shortcuts-${section.id}`}
              className="bg-theme-surface-raised rounded-lg p-4 border border-theme-surface-border flex flex-col gap-3"
            >
              <h3
                id={`keyboard-shortcuts-${section.id}`}
                className="text-sm font-semibold uppercase tracking-wide text-theme-text-secondary"
              >
                {t(`keyboard-shortcuts.sections.${section.id}`)}
              </h3>
              <ul className="space-y-2">
                {section.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.combo}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-theme-text-primary text-sm">
                      {t(`keyboard-shortcuts.shortcuts.${shortcut.translationKey}`)}
                    </span>
                    <kbd className="px-2 py-1 bg-theme-bg-primary text-theme-text-primary rounded border border-theme-surface-border text-xs uppercase tracking-wide">
                      {formatCombo(shortcut.combo)}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-theme-text-secondary">
            {t("keyboard-shortcuts.guides.title")}
          </h3>
          <p className="text-sm text-theme-text-secondary mt-1">
            {t("keyboard-shortcuts.guides.description")}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {WORKFLOW_GUIDES.map((guide) => (
              <Link
                key={guide.id}
                to={guide.href}
                onClick={closeModal}
                className="group flex h-full flex-col justify-between rounded-md border border-theme-surface-border bg-theme-surface-raised px-3 py-4 transition-colors hover:border-theme-button-primary"
                aria-label={t(`keyboard-shortcuts.guides.items.${guide.translationKey}.title`)}
              >
                <div>
                  <h4 className="text-sm font-semibold text-theme-text-primary">
                    {t(`keyboard-shortcuts.guides.items.${guide.translationKey}.title`)}
                  </h4>
                  <p className="mt-2 text-xs text-theme-text-secondary">
                    {t(
                      `keyboard-shortcuts.guides.items.${guide.translationKey}.description`
                    )}
                  </p>
                </div>
                <ArrowCircleUpRight
                  size={18}
                  className="mt-4 text-theme-text-secondary group-hover:text-theme-button-primary"
                  weight="bold"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </ModalWrapper>
  );
}
