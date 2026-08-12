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

Every provider in the MVGC gateway registry, re-exported as `PROVIDER_ROUTES` from
`@axemere/gateway`: `openai`, `anthropic`, `gemini` (alias `google`), `cohere`, `mistral`,
`groq`, `deepseek`, `together`, `minimax`, `moonshot`, `zhipu`, `xai`, `perplexity`,
`openrouter`, `nvidia-nim`, `upstage`, `fireworks`, `qwen`, `bytedance`, `stepfun`, `bedrock`,
`vertex`, `azure_openai`.

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
