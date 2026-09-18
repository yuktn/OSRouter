export type AgentEvent =
    | { type: "request_received" }
    | { type: "finish" }
    | { type: "thinking_start" }
    | { type: "text_delta", text: string }
    | { type: "tool_call"; callId: string, name: string, arguments: string }
    | { type: "thinking_end" }
    | { type: "error", error: string }