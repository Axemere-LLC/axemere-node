import Anthropic from "@anthropic-ai/sdk";
import { AiGatewayConfig } from "@axemere/gateway";

export { AiGatewayConfig };

/**
 * Creates an Anthropic client pre-configured to route through the Axemere AI Gateway.
 *
 * The returned client is a standard Anthropic instance — use it exactly as you would
 * the official @anthropic-ai/sdk package. All requests are proxied through the gateway,
 * which applies policy, budgets, and records usage.
 *
 * @param config - AiGatewayConfig instance (reads env vars if omitted).
 * @param options - Additional Anthropic constructor options (merged after gateway defaults).
 */
export function anthropicClient(
    config?: AiGatewayConfig,
    options?: ConstructorParameters<typeof Anthropic>[0],
): Anthropic {
    const cfg = config ?? new AiGatewayConfig();
    // Use the environment's native fetch when available (Node.js ≥18) rather than
    // the node-fetch polyfill bundled with the SDK. node-fetch v2 emits "Premature
    // close" on streaming responses when the socket close event races the data-
    // listener teardown; native fetch does not have this bug.
    const nativeFetch = typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis) as typeof fetch
        : undefined;
    return new Anthropic({
        baseURL: cfg.proxyUrl("anthropic"),
        apiKey: cfg.gateway_token || "axemere-gateway",
        ...(nativeFetch ? { fetch: nativeFetch } : {}),
        ...options,
    });
}
