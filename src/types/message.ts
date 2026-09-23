import * as z from "zod";

export const RoleSchema = z.enum([
    "system",
    "developer",
    "user",
    "assistant",
]);

export const TextContentSchema = z.object({
    type: z.literal("text"),
    text: z.string(),
});

export const ToolCallContentSchema = z.object({
    type: z.literal("tool_call"),
    id: z.string(),
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
});

export const ToolResultContentSchema = z.object({
    type: z.literal("tool_result"),
    toolCallId: z.string(),
    result: z.unknown(),
    isError: z.boolean().optional(),
});

export const ContentSchema = z.discriminatedUnion("type", [
    TextContentSchema,
    ToolCallContentSchema,
    ToolResultContentSchema,
]);

export const ChatMessageSchema = z.object({
    role: RoleSchema,
    content: z.array(ContentSchema),
});

export type Role = z.infer<typeof RoleSchema>;
export type TextContent = z.infer<typeof TextContentSchema>;
export type ToolCallContent = z.infer<typeof ToolCallContentSchema>;
export type ToolResultContent = z.infer<typeof ToolResultContentSchema>;
export type Content = z.infer<typeof ContentSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
