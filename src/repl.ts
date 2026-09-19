//Simple REPL for testing purposes. Thanks Codex!

import "dotenv/config";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import type { AgentEvent } from "./types/events.js";

import type {
    Provider,
    Model,
} from "./types/ProviderModels.js";

import type { ChatMessage } from "./types/message.js";
import type { Tool } from "./types/tool.js";

const MODELS = {
    openai: [
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
    ],

    anthropic: [
        "claude-haiku-4-5",
        "claude-opus-5",
    ],
} as const satisfies {
    [P in Provider]: readonly Model<P>[];
};

const selectedModels: {
    openai: Model<"openai">;
    anthropic: Model<"anthropic">;
} = {
    openai: "gpt-5.6-sol",
    anthropic: "claude-haiku-4-5",
};

let provider: Provider = "openai";

let messages: ChatMessage[] = [];

const tools: Tool[] = [];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isProvider(
    value: string,
): value is Provider {
    return (
        value === "openai" ||
        value === "anthropic"
    );
}

function isModel<P extends Provider>(
    provider: P,
    value: string,
): value is Model<P> {
    return (
        MODELS[provider] as readonly string[]
    ).includes(value);
}

function getCurrentModel() {
    if (provider === "openai") {
        return selectedModels.openai;
    }

    return selectedModels.anthropic;
}

function printModels() {
    console.log();

    console.log("openai:");

    for (const model of MODELS.openai) {
        const active =
            provider === "openai" &&
            selectedModels.openai === model;

        console.log(
            `  ${active ? "*" : " "} ${model}`,
        );
    }

    console.log();

    console.log("anthropic:");

    for (const model of MODELS.anthropic) {
        const active =
            provider === "anthropic" &&
            selectedModels.anthropic === model;

        console.log(
            `  ${active ? "*" : " "} ${model}`,
        );
    }

    console.log();
}

function printHelp() {
    console.log(`
Commands:

  /help
      Show this help.

  /models
      Show available providers and models.

  /provider openai
  /provider anthropic
      Change provider.

  /model <model>
      Change model for current provider.

  /use <provider> <model>
      Change provider and model at once.

  /history
      Show conversation history.

  /clear
      Clear conversation history.

  /exit
  /quit
      Exit the REPL.
`);
}

/* -------------------------------------------------------------------------- */
/* Request                                                                    */
/* -------------------------------------------------------------------------- */

const API_URL = new URL(
    "/v1/messages",
    process.env.OSROUTER_BASE_URL || `http://localhost:${process.env.PORT || 8080}`,
);

// fetch-event-source uses browser globals during cleanup even with visibility
// handling disabled. Supply only the hooks it needs in this Node-only REPL.
Object.defineProperties(globalThis, {
    window: { value: { setTimeout, clearTimeout }, configurable: true },
    document: { value: { removeEventListener() {} }, configurable: true },
});

async function runMessage() {
    let assistantText = "";
    let finished = false;

    await fetchEventSource(API_URL.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            provider,
            model: getCurrentModel(),
            input: messages,
            tools,
        }),
        fetch: globalThis.fetch,
        openWhenHidden: true,
        async onopen(response) {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            if (!response.headers.get("content-type")?.startsWith("text/event-stream")) {
                throw new Error("API did not return an SSE stream.");
            }
            if (!response.body) {
                throw new Error("API returned no response stream.");
            }
        },
        onmessage(message) {
            if (!message.data || finished) return;
            const event = JSON.parse(message.data) as AgentEvent;

            switch (event.type) {
                case "text_delta":
                    stdout.write(event.text);
                    assistantText += event.text;
                    break;
                case "tool_call":
                    console.log("\n\n[tool_call]");
                    console.log(`id:   ${event.callId}`);
                    console.log(`name: ${event.name}`);
                    console.log(`args: ${event.arguments}`);
                    break;
                case "error":
                    throw new Error(event.error);
                case "finish":
                    finished = true;
                    break;
            }
        },
        onclose() {
            if (!finished) {
                throw new Error("API stream ended before the finish event.");
            }
        },
        onerror(error) {
            // Retrying a generation POST could duplicate output and API charges.
            throw error;
        },
    });

    if (assistantText.length > 0) {
        messages.push({
            role: "assistant",
            content: [{ type: "text", text: assistantText }],
        });
    }
}

/* -------------------------------------------------------------------------- */
/* REPL                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
    const rl = readline.createInterface({
        input: stdin,
        output: stdout,
    });

    console.log("OSRouter REPL");
    console.log("Type /help for commands.");
    console.log();

    while (true) {
        const model = getCurrentModel();

        let line: string;

        try {
            line = await rl.question(
                `[${provider}:${model}] > `,
            );
        } catch {
            break;
        }

        line = line.trim();

        if (!line) {
            continue;
        }

        /* ------------------------------------------------------------------ */
        /* Exit                                                               */
        /* ------------------------------------------------------------------ */

        if (
            line === "/exit" ||
            line === "/quit"
        ) {
            break;
        }

        /* ------------------------------------------------------------------ */
        /* Help                                                               */
        /* ------------------------------------------------------------------ */

        if (line === "/help") {
            printHelp();
            continue;
        }

        /* ------------------------------------------------------------------ */
        /* Models                                                             */
        /* ------------------------------------------------------------------ */

        if (line === "/models") {
            printModels();
            continue;
        }

        /* ------------------------------------------------------------------ */
        /* History                                                            */
        /* ------------------------------------------------------------------ */

        if (line === "/history") {
            console.dir(
                messages,
                {
                    depth: null,
                    colors: true,
                },
            );

            continue;
        }

        /* ------------------------------------------------------------------ */
        /* Clear                                                              */
        /* ------------------------------------------------------------------ */

        if (line === "/clear") {
            messages = [];

            console.log(
                "conversation history cleared",
            );

            continue;
        }

        /* ------------------------------------------------------------------ */
        /* Provider                                                           */
        /* ------------------------------------------------------------------ */

        if (line.startsWith("/provider ")) {
            const value = line
                .slice("/provider ".length)
                .trim();

            if (!isProvider(value)) {
                console.log(
                    `unknown provider: ${value}`,
                );

                console.log(
                    "available: openai, anthropic",
                );

                continue;
            }

            provider = value;

            console.log(
                `using ${provider}:${getCurrentModel()}`,
            );

            continue;
        }

        /* ------------------------------------------------------------------ */
        /* Model                                                              */
        /* ------------------------------------------------------------------ */

        if (line.startsWith("/model ")) {
            const value = line
                .slice("/model ".length)
                .trim();

            if (provider === "openai") {
                if (!isModel("openai", value)) {
                    console.log(
                        `unknown openai model: ${value}`,
                    );

                    console.log(
                        MODELS.openai.join("\n"),
                    );

                    continue;
                }

                selectedModels.openai = value;
            } else {
                if (!isModel("anthropic", value)) {
                    console.log(
                        `unknown anthropic model: ${value}`,
                    );

                    console.log(
                        MODELS.anthropic.join("\n"),
                    );

                    continue;
                }

                selectedModels.anthropic = value;
            }

            console.log(
                `using ${provider}:${getCurrentModel()}`,
            );

            continue;
        }

        /* ------------------------------------------------------------------ */
        /* Use                                                                */
        /* ------------------------------------------------------------------ */

        if (line.startsWith("/use ")) {
            const parts = line.split(/\s+/);

            const providerValue = parts[1];
            const modelValue = parts[2];

            if (
                !providerValue ||
                !modelValue
            ) {
                console.log(
                    "usage: /use <provider> <model>",
                );

                continue;
            }

            if (!isProvider(providerValue)) {
                console.log(
                    `unknown provider: ${providerValue}`,
                );

                continue;
            }

            if (providerValue === "openai") {
                if (
                    !isModel(
                        "openai",
                        modelValue,
                    )
                ) {
                    console.log(
                        `unknown openai model: ${modelValue}`,
                    );

                    console.log(
                        MODELS.openai.join("\n"),
                    );

                    continue;
                }

                provider = "openai";
                selectedModels.openai =
                    modelValue;
            } else {
                if (
                    !isModel(
                        "anthropic",
                        modelValue,
                    )
                ) {
                    console.log(
                        `unknown anthropic model: ${modelValue}`,
                    );

                    console.log(
                        MODELS.anthropic.join("\n"),
                    );

                    continue;
                }

                provider = "anthropic";
                selectedModels.anthropic =
                    modelValue;
            }

            console.log(
                `using ${provider}:${getCurrentModel()}`,
            );

            continue;
        }

        /* ------------------------------------------------------------------ */
        /* User message                                                       */
        /* ------------------------------------------------------------------ */

        messages.push({
            role: "user",
            content: [{ type: "text", text: line }],
        });

        stdout.write("\nassistant: ");

        try {
            await runMessage();

            stdout.write("\n\n");
        } catch (error) {
            /*
             * Remove the user message if the
             * request failed.
             */
            messages.pop();

            stdout.write("\n");

            if (error instanceof Error) {
                console.error(
                    `request failed: ${error.message}`,
                );
            } else {
                console.error(
                    "request failed:",
                    error,
                );
            }

            console.log();
        }
    }

    rl.close();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});