import React from "react";
import ChatBubble from "@/components/ChatBubble";

const messages = [
  {
    id: 1,
    message: "Hi team! Can you recap the new theming API?",
    type: "user",
  },
  {
    id: 2,
    message:
      "Absolutely. Theme Studio now derives procedural overlays, respects reduced motion, and saves per-user tokens.",
    type: "assistant",
  },
];

export default {
  title: "Chat UI/Conversations",
  parameters: { layout: "fullscreen" },
};

export const AssistantAndUser = {
  render: () => (
    <div className="max-w-3xl mx-auto bg-theme-bg-primary rounded-2xl border border-theme-home-border divide-y divide-theme-home-border">
      {messages.map((item) => (
        <ChatBubble key={item.id} message={item.message} type={item.type} />
      ))}
    </div>
  ),
};
