# @axemere/gateway-anthropic

Drop-in Anthropic client factory for the [Axemere AI Gateway](https://axemere.ai).

Returns a standard `Anthropic` instance pre-configured to route through the gateway. All existing Anthropic code works unchanged — the gateway adds cost controls, policy enforcement, and an append-only audit ledger to every call.

## Install

```bash
npm install @axemere/gateway-anthropic
```

## Usage

```typescript
import { anthropicClient } from "@axemere/gateway-anthropic";

const client = anthropicClient(); // reads AXEMERE_GATEWAY_URL + AXEMERE_WORKLOAD_TOKEN

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 256,
  messages: [{ role: "user", content: "Hello" }],
});
console.log(message.content[0].text);
```

Streaming works exactly as it does with the standard `@anthropic-ai/sdk` package.

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
