import { createPortal } from "react-dom";
import useAccessibleModal from "@/hooks/useAccessibleModal";

export default function ModalWrapper({
  children,
  isOpen,
  noPortal = false,
  label,
  labelledBy,
  describedBy,
  onClose,
  initialFocus,
  restoreFocusOnClose,
}) {
  const { containerRef, getDialogProps, handleKeyDown } = useAccessibleModal(
    Boolean(isOpen),
    {
      label,
      labelledBy,
      describedBy,
      onClose,
      initialFocus,
      restoreFocusOnClose,
    }
  );

  if (!isOpen) return null;

  const overlay = (
    <div
      className="bg-black/60 backdrop-blur-sm fixed top-0 left-0 outline-none w-screen h-screen flex items-center justify-center z-99"
      role="presentation"
    >
      <div
        {...getDialogProps({
          className:
            "relative outline-none focus-visible:ring-2 focus-visible:ring-theme-button-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          onKeyDown: handleKeyDown,
        })}
        ref={containerRef}
      >
        {children}
      </div>
    </div>
  );

  if (noPortal) {
    return overlay;
  }

  const root = document.getElementById("root");
  if (!root) return overlay;
  return createPortal(overlay, root);
}
