# Changelog

All notable changes to the Axemere Node SDK are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- `@axemere/gateway`: `AiGatewayConfig` now defaults `gateway_url` to `http://localhost:7080` when neither the option nor `AXEMERE_GATEWAY_URL` is set, matching the Python SDK so local development works without any environment configuration.

---

## [0.1.6] - 2026-06-25

### Added
- `@axemere/gateway`: `AiGatewayClient` with `execute()` and `stream()` methods for the Axemere AI Gateway Action API (`/v1/actions:execute`), supporting OpenAI-compatible, Anthropic, and Gemini providers.
- `@axemere/gateway`: `AiGatewayConfig` that reads all settings from `AXEMERE_*` environment variables at construction time with support for per-instance option overrides.
- `@axemere/gateway`: proxy mode URL builder (`AiGatewayConfig.proxyUrl()`) that produces a drop-in base URL for existing provider SDKs without changing any other client code.
- `@axemere/gateway`: `stream()` returns an `AsyncIterable<StreamChunk>` where the final chunk carries the record ID and metering data from the gateway.
- `@axemere/gateway`: per-request and config-level attribution fields (`workload_id`, `project_id`, `account_id`, `customer_id`, `labels`) forwarded for cost allocation and reporting.
- `@axemere/gateway`: typed errors (`PolicyDeniedError`, `QuotaExceededError`, `GatewayTimeoutError`) with actionable fields so callers can handle each failure mode explicitly.
- `@axemere/gateway-openai`: `openaiClient()` factory that returns a pre-configured `openai.OpenAI` instance routed through the gateway; swap the import and no other code changes are needed.
- `@axemere/gateway-anthropic`: `anthropicClient()` factory that returns a pre-configured `@anthropic-ai/sdk` `Anthropic` instance routed through the gateway, using native fetch to avoid streaming issues with older node-fetch versions.
- Support for 20+ providers via proxy mode: openai, anthropic, gemini, cohere, mistral, groq, deepseek, together, fireworks, perplexity, openrouter, xai, nvidia-nim, upstage, moonshot, minimax, zhipu, and more.
- Requires Node.js ≥ 18 (native `fetch` required; no polyfill needed).

### Fixed
- `@axemere/gateway-openai`: unit tests now correctly isolate against live `AXEMERE_*` environment variables so the suite passes whether or not real credentials are present.
- `@axemere/gateway-anthropic`: same test environment isolation fix as `gateway-openai`.

[Unreleased]: https://github.com/Axemere-LLC/axemere-node/compare/v0.1.6...HEAD
[0.1.6]: https://github.com/Axemere-LLC/axemere-node/releases/tag/v0.1.6
