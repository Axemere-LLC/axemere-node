export interface AiGatewayOptions {
    gateway_url?: string;
    gateway_token?: string;
    default_provider?: string;
    default_model?: string;
    workload_id?: string;
    project_id?: string;
    account_id?: string;
    customer_id?: string;
    labels?: Record<string, string>;
    provider_api_key?: string;
    timeout?: number;
}

function parseLabelsEnv(raw: string): Record<string, string> {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            const result: Record<string, string> = {};
            for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
                result[k] = String(v);
            }
            return result;
        }
    } catch {
        // Ignore parse errors — return empty
    }
    return {};
}

/**
 * Resolved configuration for talking to the Axemere AI Gateway.
 *
 * Each field is taken from the matching {@link AiGatewayOptions} value when
 * provided, otherwise from its `AXEMERE_*` environment variable, otherwise a
 * safe default. Values are read once at construction time. Also builds the
 * proxy base URL used by the OpenAI/Anthropic drop-in wrappers.
 *
 * @example
 * ```ts
 * // From env (AXEMERE_GATEWAY_URL, AXEMERE_GATEWAY_TOKEN, ...)
 * const config = new AiGatewayConfig();
 * // Or explicit overrides
 * const config2 = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
 * ```
 */
export class AiGatewayConfig {
    readonly gateway_url: string;
    readonly gateway_token: string;
    default_provider: string;
    default_model: string;
    readonly workload_id: string;
    readonly project_id: string;
    readonly account_id: string;
    readonly customer_id: string;
    readonly labels: Record<string, string>;
    readonly provider_api_key: string;
    readonly timeout: number;

    constructor(opts: AiGatewayOptions = {}) {
        // Constructor args take precedence over env vars (read at construction time).
        this.gateway_url =
            opts.gateway_url ?? process.env["AXEMERE_GATEWAY_URL"] ?? "";
        this.gateway_token =
            opts.gateway_token ?? process.env["AXEMERE_GATEWAY_TOKEN"] ?? "";
        this.default_provider =
            opts.default_provider ?? process.env["AXEMERE_PROVIDER"] ?? "";
        this.default_model =
            opts.default_model ?? process.env["AXEMERE_MODEL"] ?? "";
        this.workload_id =
            opts.workload_id ?? process.env["AXEMERE_WORKLOAD_ID"] ?? "";
        this.project_id =
            opts.project_id ?? process.env["AXEMERE_PROJECT_ID"] ?? "";
        this.account_id =
            opts.account_id ?? process.env["AXEMERE_ACCOUNT_ID"] ?? "";
        this.customer_id =
            opts.customer_id ?? process.env["AXEMERE_CUSTOMER_ID"] ?? "";
        this.provider_api_key =
            opts.provider_api_key ?? process.env["AXEMERE_PROVIDER_API_KEY"] ?? "";

        // Timeout in seconds; falls back to 120 on missing/invalid input so an
        // unparseable env value can never produce a NaN AbortController delay.
        const timeoutEnv = process.env["AXEMERE_TIMEOUT_SECONDS"];
        const rawTimeout = opts.timeout ?? (timeoutEnv ? parseInt(timeoutEnv, 10) : undefined);
        this.timeout =
            rawTimeout === undefined || isNaN(rawTimeout) || rawTimeout <= 0
                ? 120
                : rawTimeout;

        if (opts.labels !== undefined) {
            this.labels = opts.labels;
        } else {
            const labelsEnv = process.env["AXEMERE_LABELS"];
            this.labels = labelsEnv ? parseLabelsEnv(labelsEnv) : {};
        }
    }

    /**
     * Builds the proxy base URL for a given provider.
     * Format: {gateway_url}/proxy/{provider}[/k/{gateway_token}][/w/{workload_id}]
     *         [/p/{project_id}][/a/{account_id}][/c/{customer_id}]/
     */
    proxyUrl(provider: string): string {
        let url = `${this.gateway_url}/proxy/${provider}`;
        if (this.gateway_token) url += `/k/${this.gateway_token}`;
        if (this.workload_id)   url += `/w/${this.workload_id}`;
        if (this.project_id)    url += `/p/${this.project_id}`;
        if (this.account_id)    url += `/a/${this.account_id}`;
        if (this.customer_id)   url += `/c/${this.customer_id}`;
        url += "/";
        return url;
    }

    setDefaults(opts: { provider?: string; model?: string }): void {
        if (opts.provider !== undefined) this.default_provider = opts.provider;
        if (opts.model !== undefined)    this.default_model    = opts.model;
    }
}
