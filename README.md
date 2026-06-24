# Axemere AI Gateway — TypeScript / Node.js SDK

TypeScript client packages for the [Axemere AI Gateway](https://axemere.ai).

## Packages

| Package | Install | Description |
|---------|---------|-------------|
| `@axemere/gateway` | `npm install @axemere/gateway` | Core client — explicit API, config, errors |
| `@axemere/gateway-openai` | `npm install @axemere/gateway-openai` | OpenAI drop-in |
| `@axemere/gateway-anthropic` | `npm install @axemere/gateway-anthropic` | Anthropic drop-in |

## Quick start

```bash
npm install @axemere/gateway
```

```typescript
import { AiGatewayClient, AiGatewayConfig } from "@axemere/gateway";

const config = new AiGatewayConfig(); // reads AXEMERE_GATEWAY_URL, AXEMERE_WORKLOAD_TOKEN
const client = new AiGatewayClient(config);

const result = await client.execute({
  provider: "openai",
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(result.content);
console.log(result.metering?.cost_usd);
```

## Examples

See [`examples/`](examples/) for 10 runnable examples covering all major providers,
streaming, delegation, governance, and proxy mode.

```bash
pnpm install
cd examples
npx ts-node 01_basic_chat.ts
```

## Requirements

- Node.js 18+
- A running Axemere AI Gateway (`AXEMERE_GATEWAY_URL`)
- A workload token (`AXEMERE_WORKLOAD_TOKEN`)

## License

MIT — see [LICENSE](LICENSE).
