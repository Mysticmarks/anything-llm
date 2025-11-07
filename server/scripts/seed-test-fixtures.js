const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(__dirname, "..", "storage");

async function resetDatabase() {
  await prisma.$transaction([
    prisma.workspace_agent_invocations.deleteMany({}),
    prisma.workspace_chats.deleteMany({}),
    prisma.workspace_suggested_messages.deleteMany({}),
    prisma.workspace_documents.deleteMany({}),
    prisma.workspace_threads.deleteMany({}),
    prisma.document_vectors.deleteMany({}),
    prisma.workspace_users.deleteMany({}),
    prisma.workspaces.deleteMany({}),
    prisma.embed_configs.deleteMany({}),
    prisma.embed_chats.deleteMany({}),
    prisma.api_keys.deleteMany({}),
    prisma.users.deleteMany({}),
    prisma.system_settings.deleteMany({}),
  ]);
}

async function seedSystemSettings() {
  const settings = [
    { label: "multi_user_mode", value: "false" },
    { label: "telemetry_id", value: "integration-system" },
    { label: "text_splitter_chunk_size", value: "800" },
    { label: "text_splitter_chunk_overlap", value: "50" },
    { label: "onboarding_complete", value: "true" },
  ];

  await prisma.$transaction(
    settings.map((setting) =>
      prisma.system_settings.upsert({
        where: { label: setting.label },
        create: setting,
        update: { value: setting.value },
      })
    )
  );
}

async function seedUsers() {
  const adminPassword = bcrypt.hashSync("Password123!", 10);
  return prisma.users.create({
    data: {
      username: "integration-admin",
      password: adminPassword,
      role: "admin",
      seen_recovery_codes: true,
    },
  });
}

async function seedWorkspace(adminUser) {
  const workspace = await prisma.workspaces.create({
    data: {
      name: "Regression QA",
      slug: "regression",
      chatProvider: "litellm",
      chatModel: "integration-mock",
      agentProvider: "litellm",
      agentModel: "integration-mock",
      similarityThreshold: 0.2,
      queryRefusalResponse:
        "There is no relevant information in this workspace to answer your query.",
      topN: 4,
      openAiHistory: 8,
    },
  });

  await prisma.workspace_users.create({
    data: {
      user_id: adminUser.id,
      workspace_id: workspace.id,
    },
  });

  await prisma.workspace_suggested_messages.createMany({
    data: [
      {
        workspaceId: workspace.id,
        heading: "Summarize",
        message: "Provide a summary of the workspace knowledge base.",
      },
      {
        workspaceId: workspace.id,
        heading: "Next steps",
        message: "Outline recommended follow-up actions.",
      },
    ],
  });

  await prisma.workspace_chats.create({
    data: {
      workspaceId: workspace.id,
      prompt: "What documents are available?",
      response: JSON.stringify({
        text: "Integration response for: What documents are available?",
        sources: [],
        type: "chat",
      }),
      include: true,
    },
  });

  return workspace;
}

async function seedApiKey(adminUser) {
  await prisma.api_keys.create({
    data: {
      secret: "integration-test-key",
      createdBy: adminUser.id,
    },
  });
}

function writeAgentFlowFixture(workspace) {
  const flowsDir = path.join(STORAGE_DIR, "plugins", "agent-flows");
  fs.mkdirSync(flowsDir, { recursive: true });

  for (const file of fs.readdirSync(flowsDir)) {
    if (file.endsWith(".json")) {
      fs.rmSync(path.join(flowsDir, file));
    }
  }

  const flowConfig = {
    name: "Status Reporter",
    description: "Echoes back status updates for integration tests.",
    active: true,
    workspace: workspace.slug,
    steps: [
      {
        id: "start",
        type: "start",
        config: {
          variables: [
            {
              name: "status",
              label: "Status",
              type: "string",
              required: true,
            },
          ],
        },
      },
      {
        id: "respond",
        type: "llmInstruction",
        config: {
          instruction: "Report the provided status in a full sentence",
        },
      },
    ],
  };

  const flowPath = path.join(flowsDir, "integration-status.json");
  fs.writeFileSync(flowPath, JSON.stringify(flowConfig, null, 2));
}

async function main() {
  await resetDatabase();
  await seedSystemSettings();
  const adminUser = await seedUsers();
  const workspace = await seedWorkspace(adminUser);
  await seedApiKey(adminUser);
  writeAgentFlowFixture(workspace);
  console.log("Seeded integration fixtures.");
}

main()
  .catch((error) => {
    console.error("Failed to seed test fixtures", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
