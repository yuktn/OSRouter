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

export type Provider = keyof typeof providerModels;

export type Model<P extends Provider> =
    typeof providerModels[P][number];

export type AnyModel = Model<Provider>;

export function isProvider(value: unknown): value is Provider {
    return (
        typeof value === "string" &&
        value in providerModels
    );
}

export function isModel<P extends Provider>(
    provider: P,
    value: unknown
): value is Model<P> {
    return (
        typeof value === "string" &&
        (providerModels[provider] as readonly string[]).includes(value)
    );
}