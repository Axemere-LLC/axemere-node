# Changelog

All notable changes to the Axemere Node SDK are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `@axemere/gateway-google`: new package — `genaiClient()` factory that returns a `GoogleGenerativeAI` instance pre-configured to route all model requests through the Axemere AI Gateway; gateway auth headers and base URL are injected automatically into every `getGenerativeModel()` call.
- `@axemere/gateway-langchain`: new package — `ChatAiGateway` LangChain `BaseChatModel` that routes chat completions through the Axemere AI Gateway action API, supporting 12 providers; also re-exports `aiGatewayOpenAIClient` and `aiGatewayAnthropicClient` for proxy-mode use from within LangChain workflows.
- `@axemere/gateway`: `aiGatewayHeaders()` helper and `PLACEHOLDER_API_KEY` constant are now part of the public API, enabling third-party gateway wrapper packages.

---

## [0.1.8] - 2026-06-26

### Fixed
- `@axemere/gateway`: `AiGatewayClient.execute()` now defaults `max_tokens` to `256` when the caller omits it, preventing HTTP 400 errors from Anthropic ("max_tokens: Field required"). Callers that pass an explicit value are unaffected.

---

## [0.1.7] - 2026-06-25

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

[Unreleased]: https://github.com/Axemere-LLC/axemere-node/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/Axemere-LLC/axemere-node/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/Axemere-LLC/axemere-node/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/Axemere-LLC/axemere-node/releases/tag/v0.1.6
