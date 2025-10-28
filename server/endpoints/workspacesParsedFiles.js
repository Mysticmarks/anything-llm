const { reqBody, multiUserMode, userFromSession } = require("../utils/http");
const { handleFileUpload } = require("../utils/files/multer");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const { Telemetry } = require("../models/telemetry");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { EventLogs } = require("../models/eventLogs");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const { CollectorApi } = require("../utils/collectorApi");
const { WorkspaceThread } = require("../models/workspaceThread");
const { WorkspaceParsedFiles } = require("../models/workspaceParsedFiles");
const { LatencyProfiler } = require("../utils/telemetry/latencyProfiler");

function workspaceParsedFilesEndpoints(app) {
  if (!app) return;

  app.get(
    "/workspace/:slug/parsed-files",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async (request, response) => {
      try {
        const threadSlug = request.query.threadSlug || null;
        const user = await userFromSession(request, response);
        const workspace = response.locals.workspace;
        const thread = threadSlug
          ? await WorkspaceThread.get({ slug: String(threadSlug) })
          : null;
        const { files, contextWindow, currentContextTokenCount } =
          await WorkspaceParsedFiles.getContextMetadataAndLimits(
            workspace,
            thread || null,
            multiUserMode(response) ? user : null
          );

        return response
          .status(200)
          .json({ files, contextWindow, currentContextTokenCount });
      } catch (e) {
        console.error(e.message, e);
        return response.sendStatus(500).end();
      }
    }
  );

  app.delete(
    "/workspace/:slug/delete-parsed-files",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async function (request, response) {
      try {
        const { fileIds = [] } = reqBody(request);
        if (!fileIds.length) return response.sendStatus(400).end();
        const success = await WorkspaceParsedFiles.delete({
          id: { in: fileIds.map((id) => parseInt(id)) },
        });
        return response.status(success ? 200 : 500).end();
      } catch (e) {
        console.error(e.message, e);
        return response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/workspace/:slug/embed-parsed-file/:fileId",
    [
      validatedRequest,
      // Embed is still an admin/manager only feature
      flexUserRoleValid([ROLES.admin, ROLES.manager]),
      validWorkspaceSlug,
    ],
    async function (request, response) {
      const { fileId = null } = request.params;
      const span = LatencyProfiler.startSpan("ingestion.embedParsedFile", {
        workspace: response.locals.workspace?.slug,
        fileId,
      });
      try {
        const user = await userFromSession(request, response);
        const workspace = response.locals.workspace;

        if (!fileId) return response.sendStatus(400).end();
        const { success, error, document } =
          await WorkspaceParsedFiles.moveToDocumentsAndEmbed(fileId, workspace);

        if (!success) {
          return response.status(500).json({
            success: false,
            error: error || "Failed to embed file",
          });
        }

        await Telemetry.sendTelemetry("document_embedded");
        await EventLogs.logEvent(
          "document_embedded",
          {
            documentName: document?.name || "unknown",
            workspaceId: workspace.id,
          },
          user?.id
        );

        return response.status(200).json({
          success: true,
          error: null,
          document,
        });
      } catch (e) {
        console.error(e.message, e);
        return response.sendStatus(500).end();
      } finally {
        if (!fileId) return;
        await WorkspaceParsedFiles.delete({ id: parseInt(fileId) });
        span.end({ status: "completed" });
      }
    }
  );

  app.post(
    "/workspace/:slug/parse",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.all]),
      handleFileUpload,
      validWorkspaceSlug,
    ],
    async function (request, response) {
      let span = null;
      try {
        const user = await userFromSession(request, response);
        const workspace = response.locals.workspace;
        const Collector = new CollectorApi();
        const { originalname } = request.file;
        span = LatencyProfiler.startSpan("ingestion.parse", {
          workspace: workspace?.slug,
          filename: originalname,
        });
        const processingOnline = await Collector.online();

        if (!processingOnline) {
          return response.status(500).json({
            success: false,
            error: `Document processing API is not online. Document ${originalname} will not be parsed.`,
          });
        }

        const { success, reason, documents } =
          await Collector.parseDocument(originalname);
        if (!success || !documents?.[0]) {
          return response.status(500).json({
            success: false,
            error: reason || "No document returned from collector",
          });
        }

        // Get thread ID if we have a slug
        const { threadSlug = null } = reqBody(request);
        const thread = threadSlug
          ? await WorkspaceThread.get({
              slug: String(threadSlug),
              workspace_id: workspace.id,
              user_id: user?.id || null,
            })
          : null;
        const files = await Promise.all(
          documents.map(async (doc) => {
            const metadata = { ...doc };
            // Strip out pageContent
            delete metadata.pageContent;
            const filename = `${originalname}-${doc.id}.json`;
            const { file, error: dbError } = await WorkspaceParsedFiles.create({
              filename,
              workspaceId: workspace.id,
              userId: user?.id || null,
              threadId: thread?.id || null,
              metadata: JSON.stringify(metadata),
              tokenCountEstimate: doc.token_count_estimate || 0,
            });

            if (dbError) throw new Error(dbError);
            return file;
          })
        );

        Collector.log(`Document ${originalname} parsed successfully.`);
        await EventLogs.logEvent(
          "document_uploaded_to_chat",
          {
            documentName: originalname,
            workspace: workspace.slug,
            thread: thread?.name || null,
          },
          user?.id
        );

        const payload = {
          success: true,
          error: null,
          files,
        };
        span?.end({ status: "ok", documents: files.length });
        return response.status(200).json(payload);
      } catch (e) {
        console.error(e.message, e);
        if (span) {
          span.end({ status: "error", error: e?.message || e });
        } else {
          LatencyProfiler.addSpan("ingestion.parse", 0, {
            status: "error",
            error: e?.message || e,
          });
        }
        return response.sendStatus(500).end();
      }
    }
  );
}

module.exports = { workspaceParsedFilesEndpoints };
