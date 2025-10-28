import React from "react";

export default function FileNode({
  config,
  onConfigChange,
  renderVariableSelect,
}) {
  const pathMissing = !config.path?.trim();
  const needsContent = config.operation !== "read";
  const contentMissing = needsContent && !config.content?.trim();
  const inputBaseClasses =
    "w-full p-2.5 text-sm rounded-lg bg-theme-bg-primary text-white placeholder:text-white/20 focus:ring-1 outline-none";

  const getInputClass = (hasError) =>
    `${inputBaseClasses} border ${
      hasError
        ? "border-red-500/60 focus:border-red-400 focus:ring-red-400"
        : "border-white/5 focus:border-primary-button focus:ring-primary-button"
    }`;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          Operation
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Choose how the agent should interact with the file system.
        </p>
        <select
          value={config.operation}
          onChange={(e) => onConfigChange({ operation: e.target.value })}
          className={`${inputBaseClasses} border border-white/5 focus:border-primary-button focus:ring-primary-button`}
        >
          <option value="read" className="bg-theme-bg-primary">
            Read File
          </option>
          <option value="write" className="bg-theme-bg-primary">
            Write File
          </option>
          <option value="append" className="bg-theme-bg-primary">
            Append to File
          </option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          File Path
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Paths are resolved inside the AnythingLLM storage directory.
        </p>
        <input
          type="text"
          placeholder="workspace/output.txt"
          value={config.path}
          onChange={(e) => onConfigChange({ path: e.target.value })}
          className={getInputClass(pathMissing)}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={pathMissing}
        />
        {pathMissing && (
          <p className="text-xs text-red-400 mt-1">A file path is required.</p>
        )}
      </div>
      {needsContent && (
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-2">
            Content
          </label>
          <p className="text-xs text-theme-text-secondary mb-2">
            Enter the text to write or append. You can use flow variables via
            template strings (e.g. <code>{"${variable}"}</code>).
          </p>
          <textarea
            placeholder="File content..."
            value={config.content}
            onChange={(e) => onConfigChange({ content: e.target.value })}
            className={getInputClass(contentMissing)}
            rows={3}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={contentMissing}
          />
          {contentMissing && (
            <p className="text-xs text-red-400 mt-1">
              Content is required for write and append operations.
            </p>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-theme-text-primary mb-2">
          Store Result In
        </label>
        <p className="text-xs text-theme-text-secondary mb-2">
          Save the file response (or status) for use in later steps.
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
