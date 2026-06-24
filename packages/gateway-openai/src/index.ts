import OpenAI from "openai";
import { AiGatewayConfig } from "@axemere/gateway";

export { AiGatewayConfig };

/**
 * Creates an OpenAI client pre-configured to route through the Axemere AI Gateway.
 *
 * The returned client is a standard OpenAI instance — use it exactly as you would
 * the official openai package. All requests are proxied through the gateway, which
 * applies policy, budgets, and records usage.
 *
 * @param config - AiGatewayConfig instance (reads env vars if omitted).
 * @param options - Additional OpenAI constructor options (merged after gateway defaults).
 */
export function openaiClient(
    config?: AiGatewayConfig,
    options?: ConstructorParameters<typeof OpenAI>[0],
): OpenAI {
    const cfg = config ?? new AiGatewayConfig();
    return new OpenAI({
        baseURL: cfg.proxyUrl("openai") + "v1/",
        apiKey: cfg.gateway_token || "axemere-gateway",
        ...options,
    });
}
