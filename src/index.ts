import "dotenv/config";

import express, { type Request, type Response } from 'express';
import { type Provider, type Model, isProvider, isModel, ProviderSchema, AnyModelSchema } from './types/ProviderModels.js'
import * as z from 'zod';
import { ChatMessageSchema, type ChatMessage } from './types/message.js';
import { ToolSchema, type Tool } from './types/tool.js'
import { openAiMessage } from './providers/openai.js';
import { anthropicMessage } from './providers/anthropic.js';
import { type AgentEvent } from './types/events.js';
import {auth} from "./middleware/auth.js"

const app = express();
const PORT = process.env.PORT || 8080;

if (!process.env.OSROUTER_API_KEY) {
  throw new Error("No API key provided")
}

app.use(express.json({ limit: "1mb" }));


const RequestBodySchema = z.object({
  provider: ProviderSchema,
  model: AnyModelSchema,
  input: ChatMessageSchema.array(),
  tools: ToolSchema.array()
})

type RequestBody = z.infer<typeof RequestBodySchema>;

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'UP',
    uptime_seconds: Math.floor(process.uptime())
  });
});

app.post('/v0/messages', auth, async (req: Request<{}, {}, unknown>, res: Response) => {

  const result = RequestBodySchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: 'Bad request.' })
  }

  const { provider, model, input, tools } = result.data;
  
  if (!isProvider(provider)) {
    return res.status(400).json({ error: 'No such provider.' });
  }

  if (!isModel(provider, model)) {
    return res.status(400).json({ error: 'Provider and model do not match or no such model.' })
  }

  //header for SSE (check https://github.com/Azure/fetch-event-source for sending POST requests using SSE, or you can implement it yourself.)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.flushHeaders();

  res.write(
    `data: ${JSON.stringify({
      type: "connected"
    })}\n\n`
  );

  try {

    //casting as Model<"provider"> is okay here because isModel is stopping mismatched models.

    let stream: AsyncGenerator<AgentEvent>;

    switch (provider) {
      case "openai":
        stream = openAiMessage(model as Model<"openai">, input, tools);
        break;
      case "anthropic":
        stream = anthropicMessage(model as Model<"anthropic">, input, tools);
        break;
    }

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (e) {
    console.error(e);

    const message =
      e instanceof Error
        ? e.message
        : String(e);

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: message
      } satisfies AgentEvent)}\n\n`
    );
  } finally {
    res.end()
  }
})

app.listen(PORT, () => {
  console.log(`Server running at :${PORT}`);
});
