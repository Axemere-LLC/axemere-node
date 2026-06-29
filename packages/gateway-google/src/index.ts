import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ModelParams, RequestOptions } from "@google/generative-ai";
import { AiGatewayConfig, PLACEHOLDER_API_KEY, aiGatewayHeaders } from "@axemere/gateway";

export { AiGatewayConfig };

/**
 * GoogleGenerativeAI subclass that automatically routes all model requests
 * through the Axemere AI Gateway. Gateway auth headers and base URL are injected
 * into every getGenerativeModel() call without requiring the caller to pass
 * requestOptions manually.
 */
class GatewayGenerativeAI extends GoogleGenerativeAI {
    private readonly _gatewayRequestOptions: RequestOptions;

    constructor(apiKey: string, gatewayRequestOptions: RequestOptions) {
        super(apiKey);
        this._gatewayRequestOptions = gatewayRequestOptions;
    }

    getGenerativeModel(modelParams: ModelParams, requestOptions?: RequestOptions) {
        // Merge gateway defaults under caller-supplied options so callers can
        // still override baseUrl or add their own custom headers.
        const merged: RequestOptions = {
            ...this._gatewayRequestOptions,
            ...requestOptions,
        };
        // Merge customHeaders: gateway headers first, caller headers win on conflict.
        // Note: x-goog-api-key cannot be set via customHeaders (SDK enforces this),
        // so the placeholder key is forwarded as-is. The gateway recognises
        // PLACEHOLDER_API_KEY ("axemere-proxy-managed") and does not treat it as BYOK.
        const gwHeaders = new Headers(this._gatewayRequestOptions.customHeaders as RequestInit["headers"] ?? {});
        if (requestOptions?.customHeaders) {
            const callerHeaders = new Headers(requestOptions.customHeaders as RequestInit["headers"]);
            callerHeaders.forEach((val, key) => gwHeaders.set(key, val));
        }
        merged.customHeaders = gwHeaders;
        return super.getGenerativeModel(modelParams, merged);
    }
}

/**
 * Creates a GoogleGenerativeAI client pre-configured to route through the Axemere AI Gateway.
 *
 * The returned client is a standard GoogleGenerativeAI instance — use it exactly as you would
 * the official @google/generative-ai package. All requests are proxied through the gateway,
 * which applies policy, budgets, and records usage.
 *
 * @param config - AiGatewayConfig instance (reads env vars if omitted).
 * @returns A GoogleGenerativeAI instance with gateway routing applied to every model request.
 *
 * @example
 * ```ts
 * const ai = genaiClient(new AiGatewayConfig());
 * const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
 * const result = await model.generateContent("Hello");
 * ```
 */
export function genaiClient(config?: AiGatewayConfig): GatewayGenerativeAI {
    const cfg = config ?? new AiGatewayConfig();
    const headers = aiGatewayHeaders(cfg, { targetHost: "generativelanguage.googleapis.com" });

    const gatewayRequestOptions: RequestOptions = {
        baseUrl: cfg.gateway_url,
        customHeaders: new Headers(headers),
    };

    return new GatewayGenerativeAI(PLACEHOLDER_API_KEY, gatewayRequestOptions);
}
