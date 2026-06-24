# @axemere/gateway

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Framework-independent TypeScript client for the [Axemere AI Gateway](https://axemere.ai).

Use this package when you want explicit control over every request, or when you are not using OpenAI or Anthropic SDKs directly. If you are already using one of those SDKs, install the matching wrapper instead (`@axemere/gateway-openai`, `@axemere/gateway-anthropic`) — it requires no code changes beyond the import.

## Install

```bash
npm install @axemere/gateway
```

## Usage

```typescript
import { AiGatewayClient, AiGatewayConfig } from "@axemere/gateway";

const config = new AiGatewayConfig(); // reads AXEMERE_GATEWAY_URL + AXEMERE_WORKLOAD_TOKEN
const client = new AiGatewayClient(config);

const result = await client.execute({
  provider: "openai",
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(result.content);
console.log(result.metering?.cost_usd); // "0.000042"
```

## Configuration

| Env var | Description |
|---------|-------------|
| `AXEMERE_GATEWAY_URL` | Gateway base URL, e.g. `http://localhost:7080` |
| `AXEMERE_WORKLOAD_TOKEN` | Workload token issued by the gateway |
| `AXEMERE_WORKLOAD_ID` | Workload identifier for attribution |
| `AXEMERE_PROJECT_ID` | Project identifier for spend grouping |

## Links

- [Axemere AI Gateway](https://axemere.ai)
- [Documentation](https://axemere.ai/docs)
- [GitHub](https://github.com/Axemere-LLC/axemere-node)

## License

MIT
