import "dotenv/config";
import OpenAI from "openai";
import { type Tool } from "../types/tool.js"
import type { Provider, Model } from '../types/ProviderModels.js'
import type { ChatMessage } from "../types/message.js";
import { type AgentEvent } from "../types/events.js";

const openAIClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

//convert to openai specific

function toOpenAITool(tool: Tool) {
    return {
        type: "function" as const,
        name: tool.name,

        ...(tool.description !== undefined
            ? { description: tool.description }
            : {}),

        parameters: tool.parameters,
        strict: true,
    };
}

export async function* openAiMessage(
    model: Model<"openai">,
    input: ChatMessage[],
    tools: Tool[],
): AsyncGenerator<AgentEvent> {

    yield { type: "request_received" }

    const openAiTools: OpenAI.Responses.FunctionTool[] = []

    for (const tool of tools) {
        const convertedTool = toOpenAITool(tool)
        openAiTools.push(convertedTool)
    }

    const stream = await openAIClient.responses.create({
        model,
        input,
        tools: openAiTools,
        stream: true
    });

    for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
            yield { type: "text_delta", text: event.delta };
        }

        if (event.type === "response.output_item.done") {
            const item = event.item

            if (item.type === "function_call") {
                yield {
                    type: "tool_call",

                    callId: item.call_id,
                    name: item.name,
                    arguments: item.arguments,
                }
            }
        }

        if (event.type === "response.completed") {
            yield { type: "finish" }
            break;
        }
    }
}