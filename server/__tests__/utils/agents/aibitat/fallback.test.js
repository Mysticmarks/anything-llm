const AIbitat = require("../../../../utils/agents/aibitat");
const { Telemetry } = require("../../../../models/telemetry");

const DEFAULT_FALLBACK_MESSAGE =
  "No additional agents are available in this channel. Escalating to a human for review.";

describe("AIbitat channel fallback handling", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("records a fallback message and telemetry when no next node is available", async () => {
    const telemetrySpy = jest
      .spyOn(Telemetry, "sendTelemetry")
      .mockResolvedValue();

    const aibitat = new AIbitat({ provider: "openai", model: "gpt-4o" });
    const terminateSpy = jest.fn();
    aibitat.onTerminate(terminateSpy);
    aibitat.channel("content-team", ["researcher"], {
      emptySelectionFallbackMessage: "Escalating to a human operator.",
    });

    jest.spyOn(aibitat, "selectNext").mockResolvedValue(undefined);

    await aibitat.chat({ from: "content-team", to: "pm" });

    const chats = aibitat.chats;
    const lastChat = chats[chats.length - 1];

    expect(lastChat).toEqual(
      expect.objectContaining({
        from: "content-team",
        to: "pm",
        content: "Escalating to a human operator.",
        state: "fallback",
      })
    );

    expect(telemetrySpy).toHaveBeenCalledWith(
      "agent_flow_fallback",
      { channel: "content-team" },
      null,
      true
    );
    expect(terminateSpy).toHaveBeenCalledWith("content-team", aibitat);
  });

  it("uses the default fallback message when none is provided", async () => {
    jest.spyOn(Telemetry, "sendTelemetry").mockResolvedValue();

    const aibitat = new AIbitat({ provider: "openai", model: "gpt-4o" });
    aibitat.channel("support", ["agent-a"]);

    jest.spyOn(aibitat, "selectNext").mockResolvedValue(undefined);

    await aibitat.chat({ from: "support", to: "requester" });

    const chats = aibitat.chats;
    const lastChat = chats[chats.length - 1];

    expect(lastChat).toEqual(
      expect.objectContaining({
        from: "support",
        to: "requester",
        content: DEFAULT_FALLBACK_MESSAGE,
        state: "fallback",
      })
    );
  });
});
