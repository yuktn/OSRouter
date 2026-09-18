export type ProviderModels = {
    openai:
    | "gpt-5.6-sol"
    | "gpt-5.6-terra"
    | "gpt-5.6-luna"
    ,
    anthropic:
    | "claude-haiku-4-5"
    | "claude-opus-5"
}

export type Provider = keyof ProviderModels;

export type Model<P extends Provider> = ProviderModels[P];