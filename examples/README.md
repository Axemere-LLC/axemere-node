# Axemere AI Gateway — TypeScript Examples

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

Ten example scripts covering the gateway's core capabilities. Each runs with `ts-node` against a local or managed gateway.

## Setup

```bash
cd sdk/typescript/examples
cp .env.example .env
# Edit .env to match your gateway
pnpm install        # or: npm install
pnpm run:01         # run a single example
```

Or run all examples and see a pass/fail summary:

```bash
pnpm run:all
# or: npx ts-node run_all.ts --skip 7,8
```

## Examples

| # | File | What it demonstrates |
|---|------|----------------------|
| 01 | `01_basic_chat.ts` | `AiGatewayClient.execute()` against OpenAI and Anthropic; `PolicyDeniedError` when `project_id` is omitted |
| 02 | `02_openai_sdk.ts` | `openaiClient()` from `@axemere/gateway-openai` as an `openai.OpenAI` drop-in; single completion; multi-turn |
| 03 | `03_anthropic_sdk.ts` | `anthropicClient()` from `@axemere/gateway-anthropic` as an `Anthropic` drop-in; single message; multi-turn |
| 04 | `04_multi_provider.ts` | Same question to both providers; `cfg.setDefaults()` to switch provider; total spend comparison |
| 05 | `05_streaming.ts` | `execute({stream: true})` returning `AsyncIterable<StreamChunk>`; token-by-token output; metering |
| 06 | `06_proxy_mode.ts` | `cfg.proxyUrl("openai")` URL construction; raw `fetch` to proxy path; header-based routing |
| 07 | `07_delegation.ts` | Ed25519 key generation via Node `crypto`; `mvgc.delegation.v2` wire token; scope enforcement; budget cap |
| 08 | `08_governance_outcomes.ts` | HTTP 202 approval-required (+ polling); 403 policy deny; 429 rate-limit with Retry-After |
| 09 | `09_path_attribution.ts` | Workload, project, account, customer, and label attribution; per-call override; proxy-URL encoding |
| 10 | `10_routing_modes.ts` | Path-prefix routing; `X-MVGC-Target-Host` explicit override; Azure graceful skip |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AXEMERE_GATEWAY_URL` | Yes | Gateway base URL (e.g. `http://localhost:7080`) |
| `AXEMERE_WORKLOAD_ID` | Yes | Workload identifier for attribution |
| `AXEMERE_PROJECT_ID` | No | Project identifier for attribution |
| `AXEMERE_ACCOUNT_ID` | No | Account identifier for attribution |
| `AXEMERE_CUSTOMER_ID` | No | Customer identifier for attribution |
| `AXEMERE_GATEWAY_TOKEN` | Managed only | Bearer token for managed gateway auth |
| `AXEMERE_AZURE_ENDPOINT` | Example 10 | Azure OpenAI hostname (e.g. `myresource.openai.azure.com`) |
| `MVGC_ADMIN_TOKEN` | Example 08 | Gateway admin token for approval polling |

## What's not here (and why)

These Python examples have no TypeScript equivalent in this set:

- **LangChain integration** — The TypeScript LangChain SDK (`@langchain/core`) exists, but the Axemere gateway's proxy mode works with any fetch-compatible HTTP client; `02_openai_sdk.ts` and `03_anthropic_sdk.ts` cover the same use case more directly.
- **LlamaIndex integration** — `llamaindex` for TypeScript exists; the proxy-mode pattern in `06_proxy_mode.ts` applies directly.
- **Gemini SDK** — `@google/genai` works via proxy mode; see `01_basic_chat.ts` with `provider: "gemini"` or `06_proxy_mode.ts`.
- **Cohere SDK** — Use `01_basic_chat.ts` with `provider: "cohere"`.
- **Azure OpenAI SDK** — Azure routing is demonstrated in `10_routing_modes.ts`; `@azure/openai` is not required since the gateway handles the target-host header.
- **Instructor / structured output** — `zod` + response content parsing is idiomatic TypeScript; no separate example is needed.
- **Async patterns** — TypeScript is async-native; `05_streaming.ts` covers async iteration patterns.
- **Chain/RAG pipelines** — Framework-level; the gateway client is composable into any pipeline without a dedicated example.
