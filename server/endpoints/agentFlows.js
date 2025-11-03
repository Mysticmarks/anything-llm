const { v4: uuidv4 } = require("uuid");
const { AgentFlows } = require("../utils/agentFlows");
const { FLOW_TYPES } = require("../utils/agentFlows/executor");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const { Telemetry } = require("../models/telemetry");
const { Workspace } = require("../models/workspace");
const {
  EphemeralAgentHandler,
  EphemeralEventListener,
} = require("../utils/agents/ephemeral");
const {
  agentFlowQueue,
  agentCircuitBreaker,
} = require("../utils/concurrency");
const { agentLimiter } = require("../middleware/rateLimiters");

function formatMessageSegment(segment) {
  if (segment === null || segment === undefined) return "";
  if (typeof segment === "string") return segment;
  try {
    return JSON.stringify(segment);
  } catch (error) {
    return String(segment);
  }
}

async function buildAgentContext(flow, workspaceLookup) {
  if (!workspaceLookup) return { aibitat: null, listener: null, workspace: null };

  const workspace = await Workspace.get(workspaceLookup);
  if (!workspace) {
    const error = new Error("Workspace not found");
    error.statusCode = 404;
    throw error;
  }

  const handler = new EphemeralAgentHandler({
    uuid: `flow-${uuidv4()}`,
    workspace,
    prompt:
      flow?.config?.description ||
      `Executing ${flow?.name || "agent flow"} from the admin panel`,
  });

  try {
    await handler.init();
  } catch (error) {
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  const listener = new EphemeralEventListener();
  await handler.createAIbitat({
    handler: listener,
    introspection: true,
    muteUserReply: true,
  });

  const agentLogs = [];
  const originalLog = handler.aibitat?.handlerProps?.log;
  if (handler.aibitat?.handlerProps) {
    handler.aibitat.handlerProps.log = (message, ...rest) => {
      agentLogs.push(
        [message, ...rest].map((item) => formatMessageSegment(item)).join(" ")
      );
      if (typeof originalLog === "function") {
        return originalLog(message, ...rest);
      }
    };
  }

  return {
    aibitat: handler.aibitat,
    listener,
    workspace,
    agentLogs,
    teardown: () => {
      if (typeof handler.aibitat?.terminate === "function") {
        try {
          handler.aibitat.terminate();
        } catch (_) {
          // noop – termination best effort
        }
      }
      if (typeof listener.close === "function") listener.close();
    },
  };
}

function agentFlowEndpoints(app) {
  if (!app) return;

  // Save a flow configuration
  app.post(
    "/agent-flows/save",
    [validatedRequest, flexUserRoleValid([ROLES.admin]), agentLimiter],
    async (request, response) => {
      try {
        const { name, config, uuid } = request.body;

        if (!name || !config) {
          return response.status(400).json({
            success: false,
            error: "Name and config are required",
          });
        }

        const flow = AgentFlows.saveFlow(name, config, uuid);
        if (!flow || !flow.success)
          return response
            .status(200)
            .json({ flow: null, error: flow.error || "Failed to save flow" });

        if (!uuid) {
          await Telemetry.sendTelemetry("agent_flow_created", {
            blockCount: config.blocks?.length || 0,
          });
        }

        return response.status(200).json({
          success: true,
          flow,
        });
      } catch (error) {
        console.error("Error saving flow:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // List all available flows
  app.get(
    "/agent-flows/list",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (_request, response) => {
      try {
        const flows = AgentFlows.listFlows();
        return response.status(200).json({
          success: true,
          flows,
        });
      } catch (error) {
        console.error("Error listing flows:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Get a specific flow by UUID
  app.get(
    "/agent-flows/:uuid",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { uuid } = request.params;
        const flow = AgentFlows.loadFlow(uuid);
        if (!flow) {
          return response.status(404).json({
            success: false,
            error: "Flow not found",
          });
        }

        return response.status(200).json({
          success: true,
          flow,
        });
      } catch (error) {
        console.error("Error getting flow:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Run a specific flow
  app.post(
    "/agent-flows/:uuid/run",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { uuid } = request.params;
        const {
          variables = {},
          workspaceId = null,
          workspaceSlug = null,
          includeTelemetry = true,
        } = request.body || {};

        const flow = AgentFlows.loadFlow(uuid);
        if (!flow) {
          return response.status(404).json({
            success: false,
            error: "Flow not found",
          });
        }

        const requiresAgentContext = Array.isArray(flow.config?.steps)
          ? flow.config.steps.some((step) =>
              [
                FLOW_TYPES.LLM_INSTRUCTION.type,
                FLOW_TYPES.WEB_SCRAPING.type,
              ].includes(step.type)
            )
          : false;

        const workspaceLookup = workspaceId
          ? { id: Number(workspaceId) }
          : workspaceSlug
          ? { slug: String(workspaceSlug) }
          : null;

        if (requiresAgentContext && !workspaceLookup) {
          return response.status(400).json({
            success: false,
            error:
              "This flow requires a workspace context. Provide workspaceId or workspaceSlug to execute it.",
          });
        }

        let context = {
          aibitat: null,
          listener: null,
          workspace: null,
          agentLogs: [],
          teardown: () => {},
        };

        if (workspaceLookup) {
          context = await buildAgentContext(flow, workspaceLookup);
        }

        let executionResult;
        try {
          executionResult = await agentCircuitBreaker.exec(() =>
            agentFlowQueue.run(() =>
              AgentFlows.executeFlow(uuid, variables, context.aibitat)
            )
          );
        } catch (error) {
          context.teardown();
          if (error?.code === "CIRCUIT_OPEN") {
            return response.status(503).json({
              success: false,
              error:
                "Agent flow circuit breaker is open due to sustained failures. Try again soon.",
            });
          }
          console.error("Error running flow:", error);
          await Telemetry.sendTelemetry("agent_flow_execution_failed", {
            flow: uuid,
            error: error.message,
          });
          return response.status(500).json({
            success: false,
            error: error.message,
          });
        }

        context.teardown();

        await Telemetry.sendTelemetry("agent_flow_executed", {
          flow: uuid,
          variableCount: Object.keys(variables || {}).length,
          success: executionResult?.success ?? false,
        });

        const payload = {
          success: true,
          flow: {
            uuid,
            name: flow.name,
          },
          results: executionResult,
        };

        if (includeTelemetry && context.listener) {
          const { thoughts } = context.listener.packMessages();
          payload.telemetry = {
            thoughts,
            logs: context.agentLogs,
          };
        }

        if (context.workspace) {
          payload.workspace = {
            id: context.workspace.id,
            slug: context.workspace.slug,
            name: context.workspace.name,
          };
        }

        return response.status(200).json(payload);
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        if (statusCode >= 500) {
          console.error("Error running flow:", error);
        }
        return response.status(statusCode).json({
          success: false,
          error: error?.expose ? error.message : "Failed to run flow",
        });
      }
    }
  );

  // Delete a specific flow
  app.delete(
    "/agent-flows/:uuid",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { uuid } = request.params;
        const { success } = AgentFlows.deleteFlow(uuid);

        if (!success) {
          return response.status(500).json({
            success: false,
            error: "Failed to delete flow",
          });
        }

        return response.status(200).json({
          success,
        });
      } catch (error) {
        console.error("Error deleting flow:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Toggle flow active status
  app.post(
    "/agent-flows/:uuid/toggle",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { uuid } = request.params;
        const { active } = request.body;

        const flow = AgentFlows.loadFlow(uuid);
        if (!flow) {
          return response
            .status(404)
            .json({ success: false, error: "Flow not found" });
        }

        flow.config.active = active;
        const { success } = AgentFlows.saveFlow(flow.name, flow.config, uuid);

        if (!success) {
          return response
            .status(500)
            .json({ success: false, error: "Failed to update flow" });
        }

        return response.json({ success: true, flow });
      } catch (error) {
        console.error("Error toggling flow:", error);
        response.status(500).json({ success: false, error: error.message });
      }
    }
  );
}

module.exports = { agentFlowEndpoints };
