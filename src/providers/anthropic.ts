import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import type {
    MessageParam,
    ContentBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { type Tool } from "../types/tool.js"
import type { Model } from '../types/ProviderModels.js'
import type { ChatMessage } from "../types/message.js";
import { type AgentEvent } from "../types/events.js";


const anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

//convert to anthropic specific

function toAnthropicTool(tool: Tool) {
    return {
        name: tool.name,

        ...(tool.description !== undefined
            ? { description: tool.description }
            : {}),

        input_schema: tool.parameters,
    };
}

export function toAnthropicInput(input: ChatMessage[]): {
    system?: string;
    messages: MessageParam[];
} {
    const instructions: string[] = [];
    const messages: MessageParam[] = [];

    for (const message of input) {
        if (message.role === "system" || message.role === "developer") {
            const text = message.content.map(content => {
                if (content.type !== "text") {
                    throw new Error("System and developer messages must contain only text.");
                }
                return content.text;
            }).join("\n\n");
            instructions.push(text);
            continue;
        }

        const content = message.content.map((block): ContentBlockParam => {
            switch (block.type) {
                case "text":
                    return { type: "text", text: block.text };
                case "tool_call":
                    if (message.role !== "assistant") {
                        throw new Error("Tool calls must belong to assistant messages.");
                    }
                    return {
                        type: "tool_use",
                        id: block.id,
                        name: block.name,
                        input: block.arguments,
                    };
                case "tool_result":
                    if (message.role !== "user") {
                        throw new Error("Tool results must belong to user messages.");
                    }
                    return {
                        type: "tool_result",
                        tool_use_id: block.toolCallId,
                        content: typeof block.result === "string"
                            ? block.result
                            : JSON.stringify(block.result) ?? "null",
                        ...(block.isError !== undefined
                            ? { is_error: block.isError }
                            : {}),
                    };
            }
        });

        messages.push({ role: message.role, content });
    }

    const system = instructions.join("\n\n");
    return { ...(system ? { system } : {}), messages };
}

export async function* anthropicMessage(
    model: Model<"anthropic">,
    input: ChatMessage[],
    tools: Tool[],
): AsyncGenerator<AgentEvent> {

    yield { type: "request_received" }

    const anthropicTools: Anthropic.Messages.Tool[] = []

    const { system, messages } = toAnthropicInput(input);

    for (const tool of tools) {
        const convertedTool = toAnthropicTool(tool)
        anthropicTools.push(convertedTool)
    }

    const stream = await anthropicClient.messages.create({
        model,
        max_tokens: 1000,
        messages,
        ...(system
            ? { system }
            : {}),

        tools: anthropicTools,
        stream: true
    })

    type PendingToolCall = {
        callId: string
        name: string
        arguments: string
        initialInput: unknown
    }

    const pendingTools = new Map<number, PendingToolCall>()

    for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { type: "text_delta", text: event.delta.text };
        }

        if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
            const tool = pendingTools.get(event.index)

            if (tool) {
                tool.arguments += event.delta.partial_json
            }
        }

        if (event.type === "content_block_stop") {
            const tool = pendingTools.get(event.index)

            if (tool) {
                yield {
                    type: "tool_call",
                    callId: tool.callId,
                    name: tool.name,
                    arguments: tool.arguments,
                }

                pendingTools.delete(event.index)
            }
        }

        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
            pendingTools.set(event.index, {
                callId: event.content_block.id,
                name: event.content_block.name,
                arguments: "",
                initialInput: event.content_block.input,
            })
        }

        if (event.type === "message_stop") {
            yield {
                type: "finish"
            }
        }
    }
}
