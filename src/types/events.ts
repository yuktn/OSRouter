import * as z from "zod";

export const AgentEventSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("connected") }),
    z.object({ type: z.literal("request_received") }),
    z.object({ type: z.literal("finish") }),
    z.object({ type: z.literal("thinking_start") }),
    z.object({ type: z.literal("text_delta"), text: z.string() }),
    z.object({
        type: z.literal("tool_call"),
        callId: z.string(),
        name: z.string(),
        arguments: z.string(),
    }),
    z.object({ type: z.literal("thinking_end") }),
    z.object({ type: z.literal("error"), error: z.string() }),
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;
