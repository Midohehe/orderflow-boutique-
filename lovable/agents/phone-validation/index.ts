import { agent, SystemTools } from "@lovable/agent-sdk";

export default agent({
  id: "phone-validation",
  name: "Phone Validation",
  description: "Starter custom agent for an agent-only Lovable project",
  instructions: `You are the primary agent for this project.

Reply in Markdown with direct, practical answers.

Follow these rules:
- Help the user complete work inside this project.
- Treat Lovable Cloud as required for this project and enable it early in the setup flow.
- Do not present Lovable Cloud as optional. If it is not enabled yet, make that clear and prioritize enabling it.
- Be explicit about what you know, what you inferred, and what still needs confirmation.
- Do not claim to use tools, access systems, or make changes unless that actually happened.
- Keep answers concise unless the user asks for more depth.`,
  systemTools: [SystemTools.EXECUTE_CODE, SystemTools.WEB_SEARCH],

  bindings: {
    app: {
      authorize: async () => ({
        actor: { kind: "service" as const, id: "main-agent" },
      }),
    },
  },

  conversation: {
    resolveThread: async ({ caller, input }) => ({
      threadId: input.threadId ?? `agent:${caller.actor.id}`,
    }),
  },
});
