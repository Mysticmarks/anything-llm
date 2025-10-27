import { Tooltip } from "react-tooltip";
import { Brain, CheckCircle } from "@phosphor-icons/react";
import LLMSelectorModal from "./index";
import { useTheme } from "@/hooks/useTheme";
import { useRef, useEffect, useState, useMemo } from "react";
import useUser from "@/hooks/useUser";
import { useModal } from "@/hooks/useModal";
import SetupProvider from "./SetupProvider";
import { motion } from "framer-motion";

export const TOGGLE_LLM_SELECTOR_EVENT = "toggle_llm_selector";
export const SAVE_LLM_SELECTOR_EVENT = "save_llm_selector";
export const PROVIDER_SETUP_EVENT = "provider_setup_requested";

export default function LLMSelectorAction() {
  const tooltipRef = useRef(null);
  const { themeMode, animationMultiplier } = useTheme();
  const { user } = useUser();
  const [saved, setSaved] = useState(false);
  const {
    isOpen: isSetupProviderOpen,
    openModal: openSetupProviderModal,
    closeModal: closeSetupProviderModal,
  } = useModal();
  const [config, setConfig] = useState({
    settings: {},
    provider: null,
  });

  function toggleLLMSelectorTooltip() {
    if (!tooltipRef.current) return;
    tooltipRef.current.isOpen
      ? tooltipRef.current.close()
      : tooltipRef.current.open();
  }

  function handleSaveLLMSelector() {
    if (!tooltipRef.current) return;
    tooltipRef.current.close();
    setSaved(true);
  }

  useEffect(() => {
    window.addEventListener(
      TOGGLE_LLM_SELECTOR_EVENT,
      toggleLLMSelectorTooltip
    );
    window.addEventListener(SAVE_LLM_SELECTOR_EVENT, handleSaveLLMSelector);
    return () => {
      window.removeEventListener(
        TOGGLE_LLM_SELECTOR_EVENT,
        toggleLLMSelectorTooltip
      );
      window.removeEventListener(
        SAVE_LLM_SELECTOR_EVENT,
        handleSaveLLMSelector
      );
    };
  }, []);

  useEffect(() => {
    if (!saved) return;
    setTimeout(() => {
      setSaved(false);
    }, 1500);
  }, [saved]);

  useEffect(() => {
    function handleProviderSetupEvent(e) {
      const { provider, settings } = e.detail;
      setConfig({
        settings,
        provider,
      });
      setTimeout(() => {
        openSetupProviderModal();
      }, 300);
    }

    window.addEventListener(PROVIDER_SETUP_EVENT, handleProviderSetupEvent);
    return () =>
      window.removeEventListener(
        PROVIDER_SETUP_EVENT,
        handleProviderSetupEvent
      );
  }, []);

  // This feature is disabled for multi-user instances where the user is not an admin
  // This is because of the limitations of model selection currently and other nuances in controls.
  if (!!user && user.role !== "admin") return null;

  const motionInteractions = useMemo(() => {
    if (!animationMultiplier) return {};
    return {
      whileHover: { scale: 1.05 },
      whileTap: { scale: 0.95 },
      transition: { duration: 0.18 * animationMultiplier, ease: "easeOut" },
    };
  }, [animationMultiplier]);

  return (
    <>
      <motion.button
        id="llm-selector-btn"
        data-tooltip-id="tooltip-llm-selector-btn"
        aria-label="LLM Selector"
        type="button"
        className="border-none relative flex justify-center items-center rounded-md opacity-60 hover:opacity-100 light:opacity-100 light:hover:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-button-primary"
        {...motionInteractions}
      >
        {saved ? (
          <CheckCircle className="w-[22px] h-[22px] pointer-events-none text-green-400" />
        ) : (
          <Brain className="w-[22px] h-[22px] pointer-events-none text-[var(--theme-sidebar-footer-icon-fill)]" />
        )}
      </motion.button>
      <Tooltip
        ref={tooltipRef}
        id="tooltip-llm-selector-btn"
        place="top"
        opacity={1}
        clickable={true}
        delayShow={300} // dont trigger tooltip instantly to not spam the UI
        delayHide={800} // Prevent the travel time from icon to window hiding tooltip
        arrowColor={
          themeMode === "light"
            ? "var(--theme-modal-border)"
            : "var(--theme-bg-primary)"
        }
        className="z-99 !w-[500px] !bg-theme-bg-primary !px-[5px] !rounded-lg !pointer-events-auto light:border-2 light:border-theme-modal-border"
      >
        <LLMSelectorModal tooltipRef={tooltipRef} />
      </Tooltip>
      <SetupProvider
        isOpen={isSetupProviderOpen}
        closeModal={closeSetupProviderModal}
        postSubmit={() => closeSetupProviderModal()}
        settings={config.settings}
        llmProvider={config.provider}
      />
    </>
  );
}
