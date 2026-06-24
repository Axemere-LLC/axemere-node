# @axemere/gateway-openai

Drop-in OpenAI client factory for the [Axemere AI Gateway](https://axemere.ai).

Returns a standard `OpenAI` instance pre-configured to route through the gateway. All existing OpenAI code works unchanged — the gateway adds cost controls, policy enforcement, and an append-only audit ledger to every call.

## Install

```bash
npm install @axemere/gateway-openai
```

## Usage

```typescript
import { openaiClient } from "@axemere/gateway-openai";

const client = openaiClient(); // reads AXEMERE_GATEWAY_URL + AXEMERE_WORKLOAD_TOKEN

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(response.choices[0].message.content);
```

Streaming works exactly as it does with the standard `openai` package.

## Configuration

| Env var | Description |
|---------|-------------|
| `AXEMERE_GATEWAY_URL` | Gateway base URL, e.g. `http://localhost:7080` |
| `AXEMERE_WORKLOAD_TOKEN` | Workload token issued by the gateway |

## Links

- [Axemere AI Gateway](https://axemere.ai)
- [Documentation](https://axemere.ai/docs)
- [GitHub](https://github.com/Axemere-LLC/axemere-node)

## License

MIT
