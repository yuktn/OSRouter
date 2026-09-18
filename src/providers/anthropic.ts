import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import type {
    MessageParam,
    ContentBlockParam,
    ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { type Tool } from "../types/tool.js"
import type { Provider, Model } from '../types/ProviderModels.js'
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

export async function* anthropicMessage(
    model: Model<"anthropic">,
    input: ChatMessage[],
    tools: Tool[],
): AsyncGenerator<AgentEvent> {

    yield { type: "request_received" }

    const anthropicTools: Anthropic.Messages.Tool[] = []

    const system = input
        .filter(message => message.role === "developer")
        .map(message => message.content)
        .join("\n\n")

    const messages = input
        .filter(message => message.role !== "developer") as MessageParam[]

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