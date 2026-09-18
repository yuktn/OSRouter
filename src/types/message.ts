export type ChatMessage = {
    role: "user" | "assistant" | "system" | "developer",
    content: string
}