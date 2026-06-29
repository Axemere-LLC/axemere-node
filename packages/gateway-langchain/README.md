# @axemere/gateway-langchain

LangChain `BaseChatModel` integration for the [Axemere AI Gateway](https://axemere.ai).

## Installation

```bash
npm install @axemere/gateway-langchain @langchain/core
```

## Usage

```ts
import { ChatAiGateway } from "@axemere/gateway-langchain";
import { HumanMessage } from "@langchain/core/messages";

const llm = new ChatAiGateway({ provider: "openai", model: "gpt-4o-mini" });
const res = await llm.invoke([new HumanMessage("Explain monads in one sentence.")]);
console.log(res.content);
```

## Supported providers

`openai`, `anthropic`, `mistral`, `google`, `xai`, `deepseek`, `groq`, `together`, `fireworks`,
`perplexity`, `openrouter`, `cohere`

## Proxy-mode convenience re-exports

```ts
import { aiGatewayOpenAIClient, aiGatewayAnthropicClient } from "@axemere/gateway-langchain";

const openai = aiGatewayOpenAIClient();
const anthropic = aiGatewayAnthropicClient();
```

## Configuration

Reads `AXEMERE_GATEWAY_URL` and `AXEMERE_GATEWAY_TOKEN` from the environment, or pass a
`config` field to the constructor.

See [@axemere/gateway](https://www.npmjs.com/package/@axemere/gateway) for all configuration options.
