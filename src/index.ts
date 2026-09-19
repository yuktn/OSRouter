import express, { type Request, type Response } from 'express';
import { type Provider, type Model, isProvider, isModel } from './types/ProviderModels.js'
import * as z from 'zod';
import type { ChatMessage } from './types/message.js';
import type { Tool } from './types/tool.js'
import { openAiMessage } from './providers/openai.js';
import { anthropicMessage } from './providers/anthropic.js';
import { type AgentEvent } from './types/events.js';

const app = express();
const PORT = process.env.PORT || 8080;

function writeSSE(
  res: Response,
  event: AgentEvent
) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

app.use(express.json());

interface RequestBody {
  provider: Provider;
  model: Model<Provider>;
  input: ChatMessage[]
  tools: Tool[]
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ message: 'Up and running!' });
});

app.post('/v1/messages', async (req: Request<{}, {}, RequestBody>, res: Response) => {

  res.write(`data: Connected to server\n\n`);

  const { provider, model, input, tools } = req.body;

  if (!isProvider(provider)) {
    return res.status(400).json({ error: 'No such provider.' });
  }

  if (!isModel(provider, model)) {
    return res.status(400).json({ error: 'Provider and model do not match or no such model.' })
  }

  //header for SSE (check https://github.com/Azure/fetch-event-source for sending POST requests using SSE. )
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.flushHeaders();


  //casting as any is okay here because isModel is stopping mismatched models.

  let stream: AsyncGenerator<AgentEvent>;


  switch (provider) {
    case "openai":
      stream = openAiMessage(model as any, input, tools);
      break;
    case "anthropic":
      stream = anthropicMessage(model as any, input, tools);
      break;
  }
  
  for await (const event of stream) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  res.end()
})

app.listen(PORT, () => {
  console.log(`Server running at :${PORT}`);
});
