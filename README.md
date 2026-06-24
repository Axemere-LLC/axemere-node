# Axemere AI Gateway — TypeScript / Node.js SDK

Add governance, cost controls, and audit trails to every AI API call — without changing your application code.

**[Get started at axemere.ai →](https://axemere.ai)**

---

## What is Axemere?

The [Axemere AI Gateway](https://axemere.ai) sits between your application and AI providers (OpenAI, Anthropic, and more). It enforces spend budgets, policy rules, and delegation controls, and records every request to an append-only audit ledger — all transparent to your existing SDK calls.

- **Drop-in replacement** — swap one import and your existing OpenAI or Anthropic code works unchanged
- **Cost controls** — per-workload and per-project spend limits enforced at the gateway
- **Policy engine** — allow/deny rules based on model, provider, context, and labels
- **Audit ledger** — tamper-evident record of every request, token count, and cost
- **Delegation** — issue scoped tokens to users or agents with budget and model limits

## Packages

| Package | Install | Use when |
|---------|---------|----------|
| `@axemere/gateway` | `npm install @axemere/gateway` | Framework-independent; explicit API |
| `@axemere/gateway-openai` | `npm install @axemere/gateway-openai` | You use `openai` SDK today |
| `@axemere/gateway-anthropic` | `npm install @axemere/gateway-anthropic` | You use `@anthropic-ai/sdk` today |

## Quick start

```bash
npm install @axemere/gateway-openai
```

```typescript
// Before
import OpenAI from "openai";

// After — one line change
import { OpenAI } from "@axemere/gateway-openai";

const client = new OpenAI(); // reads AXEMERE_GATEWAY_URL + AXEMERE_WORKLOAD_TOKEN
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(response.choices[0].message.content);
```

No other code changes needed. Every request is now governed, costed, and recorded.

## Get a gateway

- **Free tier** — self-hosted, single user, no account required. [Install →](https://axemere.ai/docs/free-gateway)
- **Self-Hosted** — team features, policy engine, full audit ledger. [Get started →](https://axemere.ai/docs/get-started/cp-connected)
- **Managed** — fully hosted, multi-tenant, SOC 2 ready. [Get started →](https://axemere.ai/docs/get-started/managed-gateway)

## Examples

See [`examples/`](examples/) for 10 runnable scripts covering all major providers, streaming, delegation, governance, and proxy mode.

```bash
pnpm install
cd examples
npx ts-node 01_basic_chat.ts
```

## Requirements

- Node.js 18+
- A running Axemere AI Gateway (`AXEMERE_GATEWAY_URL`)
- A workload token (`AXEMERE_WORKLOAD_TOKEN`)

## Links

- Website: [axemere.ai](https://axemere.ai)
- Docs: [axemere.ai/docs](https://axemere.ai/docs)
- Issues: [github.com/Axemere-LLC/axemere-node/issues](https://github.com/Axemere-LLC/axemere-node/issues)

## License

MIT — see [LICENSE](LICENSE).
