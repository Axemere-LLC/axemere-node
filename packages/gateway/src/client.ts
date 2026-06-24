import { uuidv7 } from "uuidv7";
import { AiGatewayConfig } from "./config";
import { ExecuteParams, ExecuteResponse, StreamChunk, Metering } from "./types";
import { GatewayError, PolicyDeniedError, QuotaExceededError, GatewayTimeoutError } from "./errors";
import { PROVIDER_ROUTES } from "./providers";

type WireAttribution = {
    project_id?: string;
    account_id?: string;
    customer_id?: string;
    labels?: Record<string, string>;
};

type WireBody = {
    schema: string;
    request_id: string;
    org_id: string;
    workload_id: string;
    ingress_mode: string;
    action: {
        type: string;
        method: string;
        target_host: string;
        target_path: string;
        params: Record<string, unknown>;
    };
    attribution?: WireAttribution;
    delegation_token?: string;
    credential_hint?: string;
};

export class AiGatewayClient {
    private readonly config: AiGatewayConfig;

    constructor(config: AiGatewayConfig) {
        this.config = config;
    }

    execute(params: ExecuteParams & { stream?: false }): Promise<ExecuteResponse>;
    execute(params: ExecuteParams & { stream: true }): Promise<AsyncIterable<StreamChunk>>;
    execute(params: ExecuteParams): Promise<ExecuteResponse | AsyncIterable<StreamChunk>>;
    async execute(params: ExecuteParams): Promise<ExecuteResponse | AsyncIterable<StreamChunk>> {
        const provider = (params.provider as string | undefined) ?? this.config.default_provider;
        const model = (params.model as string | undefined) ?? this.config.default_model;

        if (!provider) {
            throw new GatewayError("provider is required");
        }
        if (!model) {
            throw new GatewayError("model is required");
        }

        const route = PROVIDER_ROUTES[provider];
        if (!route) {
            throw new GatewayError(`unknown provider: ${provider}`);
        }

        const workload_id  = (params.workload_id  as string | undefined) ?? this.config.workload_id;
        const project_id   = (params.project_id   as string | undefined) ?? this.config.project_id;
        const account_id   = (params.account_id   as string | undefined) ?? this.config.account_id;
        const customer_id  = (params.customer_id  as string | undefined) ?? this.config.customer_id;
        const labels       = (params.labels as Record<string, string> | undefined) ?? this.config.labels;
        const provider_api_key = (params.provider_api_key as string | undefined) ?? this.config.provider_api_key;

        const target_path = route.path.replace("{model}", model);

        // Build provider_params: strip known SDK fields, pass remaining through.
        const {
            messages,
            provider: _p,
            model: _m,
            workload_id: _wl,
            project_id: _pi,
            account_id: _ai,
            customer_id: _ci,
            labels: _lb,
            provider_api_key: _pak,
            delegation_token,
            stream,
            ...extra_params
        } = params;

        const provider_params: Record<string, unknown> = {
            model,
            messages,
            ...extra_params,
        };

        if (stream) {
            provider_params["stream"] = true;
        }

        // Build wire body.
        const body: WireBody = {
            schema: "mvgc.action_request.v2",
            request_id: uuidv7(),
            org_id: "",
            workload_id: workload_id ?? "",
            ingress_mode: "explicit_action_request",
            action: {
                type: "llm_chat",
                method: "POST",
                target_host: route.host,
                target_path,
                params: provider_params,
            },
        };

        // Attribution — omit if all fields are empty.
        const attribution: WireAttribution = {};
        if (project_id)  attribution.project_id  = project_id;
        if (account_id)  attribution.account_id  = account_id;
        if (customer_id) attribution.customer_id = customer_id;
        if (labels && Object.keys(labels).length > 0) attribution.labels = labels;
        if (Object.keys(attribution).length > 0) {
            body.attribution = attribution;
        }

        if (delegation_token) {
            body.delegation_token = delegation_token as string;
        }
        if (provider_api_key) {
            body.credential_hint = provider_api_key;
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.config.gateway_token) {
            headers["Authorization"] = `Bearer ${this.config.gateway_token}`;
        }

        const url = `${this.config.gateway_url}/v1/actions:execute`;

        // For non-streaming requests apply a timeout via AbortController.
        const controller = new AbortController();
        const timeoutMs = this.config.timeout * 1000;
        const timeoutId = stream ? null : setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new GatewayTimeoutError("Request timed out");
            }
            throw new GatewayError(
                `Network error: ${err instanceof Error ? err.message : String(err)}`,
            );
        } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
        }

        if (response.status === 504) {
            throw new GatewayTimeoutError("Gateway timeout (HTTP 504)");
        }

        if (stream) {
            return parseStreamResponse(response);
        }

        return parseResponse(response, provider);
    }
}

async function parseResponse(response: Response, provider: string): Promise<ExecuteResponse> {
    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new GatewayError(`Failed to parse JSON response: HTTP ${response.status}`);
    }

    const obj = data as Record<string, unknown>;

    if (obj["decision"] === "deny") {
        const err = new PolicyDeniedError(
            `Request denied by policy: ${String(obj["reason"] ?? "unknown")}`,
        );
        err.status_code  = response.status;
        err.response_body = data;
        err.reason    = String(obj["reason"] ?? "");
        err.trace     = obj["trace"];
        err.record_id = typeof obj["record_id"] === "string" ? obj["record_id"] : undefined;
        throw err;
    }

    if (response.status === 429 && obj["error"] === "quota_exceeded") {
        const err = new QuotaExceededError("Quota exceeded");
        err.status_code   = 429;
        err.response_body = data;
        err.upgrade_url   = typeof obj["upgrade_url"] === "string" ? obj["upgrade_url"] : undefined;
        err.retry_after   = typeof obj["retry_after"] === "number" ? obj["retry_after"] : undefined;
        throw err;
    }

    if (!response.ok) {
        const err = new GatewayError(`HTTP ${response.status}`);
        err.status_code   = response.status;
        err.response_body = data;
        throw err;
    }

    const result = obj["result"] as Record<string, unknown> | undefined;

    if (result && typeof result["status_code"] === "number" && result["status_code"] >= 400) {
        const err = new GatewayError(`Provider error: HTTP ${result["status_code"]}`);
        err.status_code   = result["status_code"] as number;
        err.response_body = result["body"];
        throw err;
    }

    const providerBody = result?.["body"] as Record<string, unknown> | undefined;

    let content = "";
    if (providerBody) {
        if (provider === "anthropic") {
            const contentArr = providerBody["content"] as Array<{ text?: string }> | undefined;
            content = contentArr?.[0]?.text ?? "";
        } else {
            // OpenAI-compatible format
            const choices = providerBody["choices"] as
                | Array<{ message?: { content?: string } }>
                | undefined;
            content = choices?.[0]?.message?.content ?? "";
        }
    }

    return {
        content,
        record_id:        String(obj["record_id"] ?? ""),
        metering:         (obj["metering"] ?? {}) as Metering,
        provider,
        model:            String((providerBody?.["model"]) ?? (obj["model"]) ?? ""),
        record_hash:      typeof obj["record_hash"] === "string" ? obj["record_hash"] : undefined,
        provider_response: providerBody,
    };
}

function parseStreamResponse(response: Response): AsyncIterable<StreamChunk> {
    if (!response.ok) {
        return {
            [Symbol.asyncIterator]: async function* () {
                let data: unknown;
                try {
                    data = await response.json();
                } catch {
                    data = undefined;
                }
                const err = new GatewayError(`HTTP ${response.status}`);
                err.status_code   = response.status;
                err.response_body = data;
                throw err;
            },
        };
    }

    const body = response.body;
    if (!body) {
        return {
            [Symbol.asyncIterator]: async function* () {
                throw new GatewayError("Empty response body on streaming request");
            },
        };
    }

    return {
        [Symbol.asyncIterator]: async function* () {
            let recordId: string | undefined;
            let metering: Metering | undefined;

            const reader = body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Split on newlines; keep any partial line in the buffer.
                    const lines = buffer.split("\n");
                    buffer = lines.pop() ?? "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(":")) continue;

                        if (!trimmed.startsWith("data: ")) continue;
                        const payload = trimmed.slice(6).trim();

                        if (payload === "[DONE]") {
                            yield { content: "", is_final: true, record_id: recordId, metering };
                            return;
                        }

                        let chunk: Record<string, unknown>;
                        try {
                            chunk = JSON.parse(payload) as Record<string, unknown>;
                        } catch {
                            continue; // skip malformed chunks
                        }

                        if (chunk["type"] === "mvgc_metering") {
                            recordId = typeof chunk["record_id"] === "string"
                                ? chunk["record_id"]
                                : undefined;
                            metering = chunk["metering"] as Metering | undefined;
                            continue;
                        }

                        // OpenAI-compatible delta format
                        const choices = chunk["choices"] as
                            | Array<{ delta?: { content?: string } }>
                            | undefined;
                        const delta = choices?.[0]?.delta?.content;
                        if (delta) {
                            yield { content: delta, is_final: false };
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

            // Stream ended without [DONE] — emit final chunk.
            yield { content: "", is_final: true, record_id: recordId, metering };
        },
    };
}
