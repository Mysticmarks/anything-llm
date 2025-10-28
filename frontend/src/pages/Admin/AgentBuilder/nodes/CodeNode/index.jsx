import React from "react";

export default function CodeNode({
  config,
  onConfigChange,
  renderVariableSelect,
}) {
  const codeMissing = !config.code?.trim();
  const inputBaseClasses =
    "w-full p-2.5 text-sm rounded-lg bg-theme-bg-primary text-white placeholder:text-white/20 focus:ring-1 outline-none";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          Language
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Choose the runtime the snippet should execute in.
        </p>
        <select
          value={config.language}
          onChange={(e) => onConfigChange({ language: e.target.value })}
          className={`${inputBaseClasses} border border-white/5 focus:border-primary-button focus:ring-primary-button`}
        >
          <option value="javascript" className="bg-theme-bg-primary">
            JavaScript
          </option>
          <option value="python" className="bg-theme-bg-primary">
            Python
          </option>
          <option value="shell" className="bg-theme-bg-primary">
            Shell
          </option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          Code
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          The snippet runs with the current flow variables substituted before
          execution.
        </p>
        <textarea
          placeholder="Enter code..."
          value={config.code}
          onChange={(e) => onConfigChange({ code: e.target.value })}
          className={`${inputBaseClasses} font-mono border ${
            codeMissing
              ? "border-red-500/60 focus:border-red-400 focus:ring-red-400"
              : "border-white/5 focus:border-primary-button focus:ring-primary-button"
          }`}
          rows={5}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={codeMissing}
        />
        {codeMissing && (
          <p className="text-xs text-red-400 mt-1">Code is required.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          Store Result In
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Persist the execution result for subsequent blocks.
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
