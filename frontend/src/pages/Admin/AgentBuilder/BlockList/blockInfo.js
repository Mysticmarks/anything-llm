import {
  Info,
  BracketsCurly,
  Globe,
  Browser,
  FileText,
  Code,
  Brain,
  Flag,
} from "@phosphor-icons/react";

export const BLOCK_TYPES = {
  FLOW_INFO: "flowInfo",
  START: "start",
  API_CALL: "apiCall",
  WEBSITE: "website",
  FILE: "file",
  CODE: "code",
  LLM_INSTRUCTION: "llmInstruction",
  WEB_SCRAPING: "webScraping",
  FINISH: "finish",
};

const ICONS = {
  Info,
  BracketsCurly,
  Globe,
  Browser,
  FileText,
  Code,
  Brain,
  Flag,
};

export const RAW_BLOCK_INFO = {
  [BLOCK_TYPES.FLOW_INFO]: {
    label: "Flow Information",
    icon: "Info",
    description: "Basic flow information",
    defaultConfig: {
      name: "",
      description: "",
    },
    getSummary: (config) => config.name || "Untitled Flow",
  },
  [BLOCK_TYPES.START]: {
    label: "Flow Variables",
    icon: "BracketsCurly",
    description: "Configure agent variables and settings",
    getSummary: (config) => {
      const varCount = config.variables?.filter((v) => v.name)?.length || 0;
      return `${varCount} variable${varCount !== 1 ? "s" : ""} defined`;
    },
  },
  [BLOCK_TYPES.API_CALL]: {
    label: "API Call",
    icon: "Globe",
    description: "Make an HTTP request",
    defaultConfig: {
      url: "",
      method: "GET",
      headers: [],
      bodyType: "json",
      body: "",
      formData: [],
      responseVariable: "",
      directOutput: false,
    },
    getSummary: (config) => `${config.method || "GET"} ${config.url || "(no URL)"}`,
  },
  [BLOCK_TYPES.WEBSITE]: {
    label: "Open Website",
    icon: "Browser",
    description: "Read or interact with a web page",
    defaultConfig: {
      url: "",
      action: "read",
      selector: "",
      value: "",
      resultVariable: "",
      directOutput: false,
    },
    getSummary: (config) => {
      const action = (config.action || "read").toLowerCase();
      const target = config.url?.trim() || "(no URL)";
      return `${action} ${target}`;
    },
  },
  [BLOCK_TYPES.FILE]: {
    label: "File",
    icon: "FileText",
    description: "Read from or write to local storage",
    defaultConfig: {
      path: "",
      operation: "read",
      content: "",
      resultVariable: "",
      directOutput: false,
    },
    getSummary: (config) => {
      const operation = (config.operation || "read").toLowerCase();
      return `${operation} ${config.path || "(no path)"}`;
    },
  },
  [BLOCK_TYPES.CODE]: {
    label: "Code Execution",
    icon: "Code",
    description: "Run custom code snippets",
    defaultConfig: {
      language: "javascript",
      code: "",
      resultVariable: "",
      directOutput: false,
    },
    getSummary: (config) => `Run ${config.language || "javascript"} code`,
  },
  [BLOCK_TYPES.LLM_INSTRUCTION]: {
    label: "LLM Instruction",
    icon: "Brain",
    description: "Process data using LLM instructions",
    defaultConfig: {
      instruction: "",
      resultVariable: "",
      directOutput: false,
    },
    getSummary: (config) => config.instruction || "No instruction",
  },
  [BLOCK_TYPES.WEB_SCRAPING]: {
    label: "Web Scraping",
    icon: "Browser",
    description: "Scrape content from a webpage",
    defaultConfig: {
      url: "",
      captureAs: "text",
      querySelector: "",
      resultVariable: "",
      directOutput: false,
    },
    getSummary: (config) => config.url || "No URL specified",
  },
  [BLOCK_TYPES.FINISH]: {
    label: "Flow Complete",
    icon: "Flag",
    description: "End of agent flow",
    defaultConfig: {},
    getSummary: () => "Flow will end here",
  },
};

export const BLOCK_INFO = Object.fromEntries(
  Object.entries(RAW_BLOCK_INFO).map(([type, info]) => ({
    ...info,
    icon: ICONS[info.icon],
  }))
);

