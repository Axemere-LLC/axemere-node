export interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
}

export interface CostBreakdownItem {
    label: string;
    tokens: number;
    rate_per_million: string;
    subtotal_usd: string;
}

export interface Metering {
    cost_usd: string;
    tokens_in: number;
    tokens_out: number;
    bytes_in?: number;
    bytes_out?: number;
    cache_hit_tokens?: number;
    cache_miss_tokens?: number;
    cache_creation_tokens?: number;
    reasoning_tokens?: number;
    pricing_config_version?: number;
    org_pricing_config_version?: number;
    markup_multiplier_applied?: string;
    cost_breakdown?: CostBreakdownItem[];
}

export interface ExecuteResponse {
    content: string;
    record_id: string;
    metering: Metering;
    provider: string;
    model: string;
    record_hash?: string;
    provider_response?: unknown;
}

export interface StreamChunk {
    content: string;
    is_final: boolean;
    record_id?: string;
    metering?: Metering;
}

export interface ExecuteParams {
    messages: Message[];
    provider?: string;
    model?: string;
    workload_id?: string;
    project_id?: string;
    account_id?: string;
    customer_id?: string;
    labels?: Record<string, string>;
    provider_api_key?: string;
    delegation_token?: string;
    stream?: boolean;
    [key: string]: unknown;
}
