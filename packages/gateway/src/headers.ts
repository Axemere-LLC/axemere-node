import { AiGatewayConfig } from "./config";

/** Placeholder API key passed to provider SDKs that require a non-empty key. The gateway ignores it. */
export const PLACEHOLDER_API_KEY = "axemere-proxy-managed";

/**
 * Builds the standard Axemere AI Gateway request headers for proxy-mode requests.
 *
 * @param config - Gateway connection and attribution settings.
 * @param opts.targetHost - Upstream provider hostname (e.g. `"api.openai.com"`).
 *   Required in proxy mode so the gateway knows where to forward the request.
 * @returns A `Record<string, string>` of HTTP headers to merge into the outgoing request.
 */
export function aiGatewayHeaders(
    config: AiGatewayConfig,
    opts: { targetHost?: string } = {},
): Record<string, string> {
    const headers: Record<string, string> = {};

    if (config.gateway_token) {
        headers["Authorization"] = `Bearer ${config.gateway_token}`;
    }
    if (opts.targetHost) {
        headers["X-MVGC-Target-Host"] = opts.targetHost;
    }
    if (config.workload_id) {
        headers["X-MVGC-Workload-ID"] = config.workload_id;
    }
    if (config.project_id) {
        headers["X-MVGC-Project-ID"] = config.project_id;
    }
    if (config.account_id) {
        headers["X-MVGC-Account-ID"] = config.account_id;
    }
    if (config.customer_id) {
        headers["X-MVGC-Customer-ID"] = config.customer_id;
    }
    if (config.labels && Object.keys(config.labels).length > 0) {
        headers["X-MVGC-Labels"] = JSON.stringify(config.labels);
    }
    if (config.provider_api_key) {
        headers["X-MVGC-Provider-API-Key"] = config.provider_api_key;
    }

    return headers;
}
