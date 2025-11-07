import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  announce,
  focusFirstDescendant,
  restoreFocus,
  trapFocusWithin,
} from "@/utils/accessibility";

export function useAccessibleModal(isOpen, options = {}) {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const focusTrapCleanupRef = useRef(null);

  const {
    label,
    labelledBy,
    describedBy,
    onClose,
    initialFocus,
    restoreFocusOnClose = true,
  } = options;

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key !== "Escape") return;
      if (typeof onClose === "function") {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    focusTrapCleanupRef.current = trapFocusWithin(container);

    if (initialFocus) {
      if (typeof initialFocus === "string") {
        const target = container.querySelector(initialFocus);
        if (target && typeof target.focus === "function") {
          target.focus();
        } else {
          focusFirstDescendant(container);
        }
      } else if (initialFocus.current && initialFocus.current.focus) {
        initialFocus.current.focus();
      } else {
        focusFirstDescendant(container);
      }
    } else {
      focusFirstDescendant(container);
    }

    announce(`${label || "Modal"} opened`);

    return () => {
      focusTrapCleanupRef.current?.();
      focusTrapCleanupRef.current = null;
      announce(`${label || "Modal"} closed`);
      if (restoreFocusOnClose && previousFocusRef.current) {
        restoreFocus(previousFocusRef.current);
      }
    };
  }, [initialFocus, isOpen, label, restoreFocusOnClose]);

  const getDialogProps = useCallback(
    (additionalProps = {}) => ({
      role: "dialog",
      "aria-modal": true,
      "aria-label": label && !labelledBy ? label : undefined,
      "aria-labelledby": labelledBy,
      "aria-describedby": describedBy,
      tabIndex: -1,
      ...additionalProps,
    }),
    [describedBy, label, labelledBy]
  );

  const dialogProps = useMemo(
    () => getDialogProps(),
    [getDialogProps]
  );

  return {
    containerRef,
    dialogProps,
    getDialogProps,
    handleKeyDown,
  };
}

export default useAccessibleModal;
