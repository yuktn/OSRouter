import * as z from "zod"

export const ToolParametersSchema = z.object({
    type: z.literal("object"),

    properties: z
        .record(z.string(), z.unknown())
        .default({}),

    required: z
        .array(z.string())
        .default([]),

    additionalProperties: z
        .boolean()
        .default(false),
}).catchall(z.unknown())

export const ToolSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    parameters: ToolParametersSchema,
})

export type Tool = z.infer<typeof ToolSchema>