export type Role =
    | "system"
    | "developer"
    | "user"
    | "assistant";

export type TextContent = {
    type: "text";
    text: string;
};

export type ToolCallContent = {
    type: "tool_call";
    id: string;
    name: string;
    arguments: Record<string, unknown>;
};

export type ToolResultContent = {
    type: "tool_result";
    toolCallId: string;
    result: unknown;
    isError?: boolean;
};

export type Content =
    | TextContent
    | ToolCallContent
    | ToolResultContent;

export type ChatMessage = {
    role: Role;
    content: Content[];
};