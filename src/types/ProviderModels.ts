import * as z from "zod";

export const providerModels = {
    openai: [
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
    ],

    anthropic: [
        "claude-haiku-4-5",
        "claude-opus-5",
    ],
} as const;

export const ModelSchemas = z.object({
    openai: z.enum(providerModels.openai),
    anthropic: z.enum(providerModels.anthropic),
});

export const ProviderSchema = ModelSchemas.keyof();

export const AnyModelSchema = z.union([
    ModelSchemas.shape.openai,
    ModelSchemas.shape.anthropic,
]);

export type Provider = z.infer<typeof ProviderSchema>;

export type Model<P extends Provider> =
    z.infer<(typeof ModelSchemas.shape)[P]>;

export type AnyModel = z.infer<typeof AnyModelSchema>;

export function isProvider(value: unknown): value is Provider {
    return ProviderSchema.safeParse(value).success;
}

export function isModel<P extends Provider>(
    provider: P,
    value: unknown
): value is Model<P> {
    return ModelSchemas.shape[provider].safeParse(value).success;
}
