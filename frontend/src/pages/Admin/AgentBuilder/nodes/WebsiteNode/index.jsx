import React, { useMemo } from "react";

export default function WebsiteNode({
  config,
  onConfigChange,
  renderVariableSelect,
}) {
  const normalizedAction = config.action || "read";
  const requiresSelector = normalizedAction !== "read";
  const urlMissing = !config.url?.trim();
  const selectorMissing = requiresSelector && !config.selector?.trim();
  const requiresValue = normalizedAction === "type";
  const valueMissing = requiresValue && !config.value?.trim();

  const inputBaseClasses =
    "w-full p-2.5 text-sm rounded-lg bg-theme-bg-primary text-white placeholder:text-white/20 focus:ring-1 outline-none";

  const urlInputClasses = useMemo(
    () =>
      `${inputBaseClasses} border ${
        urlMissing
          ? "border-red-500/60 focus:border-red-400 focus:ring-red-400"
          : "border-white/5 focus:border-primary-button focus:ring-primary-button"
      }`,
    [inputBaseClasses, urlMissing]
  );

  const selectorInputClasses = useMemo(
    () =>
      `${inputBaseClasses} border ${
        selectorMissing
          ? "border-red-500/60 focus:border-red-400 focus:ring-red-400"
          : "border-white/5 focus:border-primary-button focus:ring-primary-button"
      }`,
    [inputBaseClasses, selectorMissing]
  );

  const valueInputClasses = useMemo(
    () =>
      `${inputBaseClasses} border ${
        valueMissing
          ? "border-red-500/60 focus:border-red-400 focus:ring-red-400"
          : "border-white/5 focus:border-primary-button focus:ring-primary-button"
      }`,
    [inputBaseClasses, valueMissing]
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          URL
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Provide the full address of the page you want the agent to open.
        </p>
        <input
          type="url"
          placeholder="https://example.com"
          value={config.url}
          onChange={(e) => onConfigChange({ url: e.target.value })}
          className={urlInputClasses}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={urlMissing}
        />
        {urlMissing && (
          <p className="text-xs text-red-400 mt-1">URL is required.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          Action
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Choose how the agent should interact with the page.
        </p>
        <select
          value={normalizedAction}
          onChange={(e) => onConfigChange({ action: e.target.value })}
          className={`${inputBaseClasses} border border-white/5 focus:border-primary-button focus:ring-primary-button text-white`}
        >
          <option value="read" className="bg-theme-bg-primary">
            Read Content
          </option>
          <option value="click" className="bg-theme-bg-primary">
            Click Element
          </option>
          <option value="type" className="bg-theme-bg-primary">
            Type Text
          </option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          CSS Selector
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Use a CSS selector (e.g. <code>.button</code> or <code>#search</code>)
          to target a specific element.
        </p>
        <input
          type="text"
          placeholder="#element-id or .class-name"
          value={config.selector}
          onChange={(e) => onConfigChange({ selector: e.target.value })}
          className={selectorInputClasses}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={selectorMissing}
        />
        {selectorMissing && (
          <p className="text-xs text-red-400 mt-1">
            A selector is required for {normalizedAction} actions.
          </p>
        )}
      </div>
      {requiresValue && (
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-2">
            Text to Type
          </label>
          <p className="text-xs text-theme-text-secondary mb-2">
            Provide the exact text that should be entered into the selected
            element.
          </p>
          <input
            type="text"
            value={config.value}
            onChange={(e) => onConfigChange({ value: e.target.value })}
            className={valueInputClasses}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={valueMissing}
          />
          {valueMissing && (
            <p className="text-xs text-red-400 mt-1">
              Text is required when typing into an element.
            </p>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          Store Result In
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Save the captured output so later steps can re-use it.
        </p>
        {renderVariableSelect(
          config.resultVariable,
          (value) => onConfigChange({ resultVariable: value }),
          "Select or create variable"
        )}
      </div>
    </div>
  );
}
