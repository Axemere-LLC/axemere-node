import { BaseChatModel, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import type { BaseMessage, MessageContent } from "@langchain/core/messages";
import {
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from "@langchain/core/messages";
import { AIMessageChunk } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AiGatewayConfig, GatewayError, PolicyDeniedError } from "@axemere/gateway";
import { openaiClient } from "@axemere/gateway-openai";
import { anthropicClient } from "@axemere/gateway-anthropic";

export { AiGatewayConfig, GatewayError, PolicyDeniedError };
export { openaiClient as aiGatewayOpenAIClient };
export { anthropicClient as aiGatewayAnthropicClient };

// ---------------------------------------------------------------------------
// Provider routing table
// ---------------------------------------------------------------------------

interface ProviderRoute {
    target_host: string;
    target_path: string;
    format: "openai" | "anthropic" | "gemini";
}

const PROVIDER_ROUTES: Record<string, ProviderRoute> = {
    openai:      { target_host: "api.openai.com",                    target_path: "/v1/chat/completions",                    format: "openai" },
    anthropic:   { target_host: "api.anthropic.com",                 target_path: "/v1/messages",                            format: "anthropic" },
    mistral:     { target_host: "api.mistral.ai",                    target_path: "/v1/chat/completions",                    format: "openai" },
    google:      { target_host: "generativelanguage.googleapis.com", target_path: "/v1beta/models/{model}:generateContent",  format: "gemini" },
    xai:         { target_host: "api.x.ai",                          target_path: "/v1/chat/completions",                    format: "openai" },
    deepseek:    { target_host: "api.deepseek.com",                  target_path: "/v1/chat/completions",                    format: "openai" },
    groq:        { target_host: "api.groq.com",                      target_path: "/openai/v1/chat/completions",             format: "openai" },
    together:    { target_host: "api.together.ai",                   target_path: "/v1/chat/completions",                    format: "openai" },
    fireworks:   { target_host: "api.fireworks.ai",                  target_path: "/inference/v1/chat/completions",          format: "openai" },
    perplexity:  { target_host: "api.perplexity.ai",                 target_path: "/chat/completions",                       format: "openai" },
    openrouter:  { target_host: "openrouter.ai",                     target_path: "/api/v1/chat/completions",                format: "openai" },
    cohere:      { target_host: "api.cohere.com",                    target_path: "/v2/chat",                                format: "openai" },
};

// ---------------------------------------------------------------------------
// Message serialization helpers
// ---------------------------------------------------------------------------

type WireMessage = Record<string, unknown>;

function messageToString(content: MessageContent): string {
    if (typeof content === "string") return content;
    return content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: string; text: string }).text)
        .join("");
}

function messagesToOpenAI(messages: BaseMessage[]): WireMessage[] {
    return messages.map((msg) => {
        if (msg instanceof SystemMessage) {
            return { role: "system", content: messageToString(msg.content) };
        }
        if (msg instanceof HumanMessage) {
            return { role: "user", content: messageToString(msg.content) };
        }
        if (msg instanceof AIMessage) {
            const entry: WireMessage = {
                role: "assistant",
                content: messageToString(msg.content) || null,
            };
            const toolCalls = msg.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
                entry["tool_calls"] = toolCalls.map((tc) => ({
                    id: tc.id ?? "",
                    type: "function",
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.args ?? {}),
                    },
                }));
            }
            return entry;
        }
        if (msg instanceof ToolMessage) {
            return {
                role: "tool",
                tool_call_id: msg.tool_call_id,
                content: messageToString(msg.content),
            };
        }
        return { role: "user", content: messageToString(msg.content) };
    });
}

function messagesToAnthropic(
    messages: BaseMessage[],
): { system: string | undefined; messages: WireMessage[] } {
    let system: string | undefined;
    const result: WireMessage[] = [];

    for (const msg of messages) {
        if (msg instanceof SystemMessage) {
            system = messageToString(msg.content);
        } else if (msg instanceof HumanMessage) {
            result.push({ role: "user", content: messageToString(msg.content) });
        } else if (msg instanceof AIMessage) {
            const toolCalls = msg.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
                const blocks: WireMessage[] = [];
                const text = messageToString(msg.content);
                if (text) blocks.push({ type: "text", text });
                for (const tc of toolCalls) {
                    blocks.push({
                        type: "tool_use",
                        id: tc.id ?? "",
                        name: tc.name,
                        input: tc.args ?? {},
                    });
                }
                result.push({ role: "assistant", content: blocks });
            } else {
                result.push({ role: "assistant", content: messageToString(msg.content) });
            }
        } else if (msg instanceof ToolMessage) {
            result.push({
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: msg.tool_call_id,
                        content: messageToString(msg.content),
                    },
                ],
            });
        } else {
            result.push({ role: "user", content: messageToString(msg.content) });
        }
    }

    return { system, messages: result };
}

function messagesToGemini(
    messages: BaseMessage[],
    maxTokens: number,
    temperature?: number,
): {
    systemInstruction: WireMessage | undefined;
    contents: WireMessage[];
    generationConfig: WireMessage;
} {
    let systemInstruction: WireMessage | undefined;
    const contents: WireMessage[] = [];
    const generationConfig: WireMessage = { maxOutputTokens: maxTokens };
    if (temperature !== undefined) generationConfig["temperature"] = temperature;

    for (const msg of messages) {
        if (msg instanceof SystemMessage) {
            systemInstruction = { parts: [{ text: messageToString(msg.content) }] };
        } else if (msg instanceof HumanMessage) {
            contents.push({ role: "user", parts: [{ text: messageToString(msg.content) }] });
        } else if (msg instanceof AIMessage) {
            contents.push({ role: "model", parts: [{ text: messageToString(msg.content) }] });
        } else {
            contents.push({ role: "user", parts: [{ text: messageToString(msg.content) }] });
        }
    }

    return { systemInstruction, contents, generationConfig };
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseOpenAIBody(body: Record<string, unknown>): AIMessage {
    const choices = body["choices"] as
        | Array<{ message?: { content?: string; tool_calls?: unknown[] } }>
        | undefined;
    if (!choices?.length) return new AIMessage({ content: "" });

    const message = choices[0].message ?? {};
    const content = message.content ?? "";
    const rawToolCalls = message.tool_calls;

    if (!rawToolCalls?.length) return new AIMessage({ content });

    const toolCalls = rawToolCalls.map((tc: unknown) => {
        const t = tc as { id?: string; function?: { name?: string; arguments?: string } };
        const argsStr = t.function?.arguments ?? "{}";
        let args: Record<string, unknown>;
        try { args = JSON.parse(argsStr) as Record<string, unknown>; }
        catch { args = { _raw: argsStr }; }
        return { id: t.id ?? "", name: t.function?.name ?? "", args, type: "tool_call" as const };
    });
    return new AIMessage({ content, tool_calls: toolCalls });
}

function parseAnthropicBody(body: Record<string, unknown>): AIMessage {
    const blocks = (body["content"] as
        | Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>
        | undefined) ?? [];
    const textParts: string[] = [];
    const toolCalls: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
        type: "tool_call";
    }> = [];

    for (const block of blocks) {
        if (block.type === "text") textParts.push(block.text ?? "");
        else if (block.type === "tool_use") {
            toolCalls.push({
                id: block.id ?? "",
                name: block.name ?? "",
                args: (block.input as Record<string, unknown>) ?? {},
                type: "tool_call",
            });
        }
    }

    const text = textParts.join("");
    return toolCalls.length > 0
        ? new AIMessage({ content: text, tool_calls: toolCalls })
        : new AIMessage({ content: text });
}

function parseGeminiBody(body: Record<string, unknown>): AIMessage {
    const candidates = (body["candidates"] as
        | Array<{ content?: { parts?: Array<{ text?: string }> } }>
        | undefined) ?? [];
    if (!candidates.length) return new AIMessage({ content: "" });
    const parts = candidates[0].content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("");
    return new AIMessage({ content: text });
}

// ---------------------------------------------------------------------------
// SSE stream text extraction
// ---------------------------------------------------------------------------

function extractStreamText(
    format: "openai" | "anthropic" | "gemini",
    chunk: Record<string, unknown>,
): string {
    if (format === "openai") {
        const choices = (chunk["choices"] as
            | Array<{ delta?: { content?: string } }>
            | undefined) ?? [];
        return choices[0]?.delta?.content ?? "";
    }
    if (format === "anthropic") {
        if (chunk["type"] === "content_block_delta") {
            return (chunk["delta"] as { type?: string; text?: string } | undefined)?.text ?? "";
        }
        return "";
    }
    // gemini
    const candidates = (chunk["candidates"] as
        | Array<{ content?: { parts?: Array<{ text?: string }> } }>
        | undefined) ?? [];
    return (candidates[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

// ---------------------------------------------------------------------------
// ChatAiGateway
// ---------------------------------------------------------------------------

export interface ChatAiGatewayFields extends BaseChatModelParams {
    provider: string;
    model: string;
    config?: AiGatewayConfig;
    maxTokens?: number;
    temperature?: number;
    workloadId?: string;
    projectId?: string;
    accountId?: string;
    customerId?: string;
    labels?: Record<string, string>;
}

/**
 * LangChain chat model that routes through the Axemere AI Gateway explicit action API.
 *
 * Supports buffered and streaming completions via `_generate()` and `_stream()`.
 * Use {@link aiGatewayOpenAIClient} or {@link aiGatewayAnthropicClient} for proxy mode.
 *
 * @example
 * ```ts
 * const llm = new ChatAiGateway({ provider: "openai", model: "gpt-4o-mini" });
 * const res = await llm.invoke("Hello");
 * console.log(res.content);
 * ```
 */
export class ChatAiGateway extends BaseChatModel {
    readonly provider: string;
    readonly model: string;
    readonly maxTokens: number;
    readonly temperature: number | undefined;
    readonly workloadId: string | undefined;
    readonly projectId: string | undefined;
    readonly accountId: string | undefined;
    readonly customerId: string | undefined;
    readonly labels: Record<string, string> | undefined;
    private readonly _config: AiGatewayConfig | undefined;

    constructor(fields: ChatAiGatewayFields) {
        super(fields);
        if (!PROVIDER_ROUTES[fields.provider]) {
            throw new GatewayError(
                `Unsupported provider "${fields.provider}". Supported: ${Object.keys(PROVIDER_ROUTES).sort().join(", ")}`,
            );
        }
        this.provider = fields.provider;
        this.model = fields.model;
        this.maxTokens = fields.maxTokens ?? 256;
        this.temperature = fields.temperature;
        this.workloadId = fields.workloadId;
        this.projectId = fields.projectId;
        this.accountId = fields.accountId;
        this.customerId = fields.customerId;
        this.labels = fields.labels;
        this._config = fields.config;
    }

    _llmType(): string {
        return "axemere-gateway";
    }

    private _getConfig(): AiGatewayConfig {
        return this._config ?? new AiGatewayConfig();
    }

    private _effectiveLabels(cfg: AiGatewayConfig): Record<string, string> {
        const base: Record<string, string> = { source: "langchain" };
        if (cfg.labels) Object.assign(base, cfg.labels);
        if (this.labels) Object.assign(base, this.labels);
        return base;
    }

    private _buildActionRequest(
        messages: BaseMessage[],
        cfg: AiGatewayConfig,
        stream: boolean,
        tools?: WireMessage[],
    ): Record<string, unknown> {
        const route = PROVIDER_ROUTES[this.provider];
        const targetPath = route.target_path.replace("{model}", this.model);

        let params: Record<string, unknown>;

        if (route.format === "openai") {
            params = {
                model: this.model,
                messages: messagesToOpenAI(messages),
                max_tokens: this.maxTokens,
            };
            if (this.temperature !== undefined) params["temperature"] = this.temperature;
            if (tools?.length) params["tools"] = tools;
        } else if (route.format === "anthropic") {
            const { system, messages: anthropicMessages } = messagesToAnthropic(messages);
            params = {
                model: this.model,
                messages: anthropicMessages,
                max_tokens: this.maxTokens,
            };
            if (system) params["system"] = system;
            if (this.temperature !== undefined) params["temperature"] = this.temperature;
            if (tools?.length) params["tools"] = tools;
        } else {
            // gemini
            const { systemInstruction, contents, generationConfig } = messagesToGemini(
                messages,
                this.maxTokens,
                this.temperature,
            );
            params = { contents, generationConfig };
            if (systemInstruction) params["systemInstruction"] = systemInstruction;
        }

        if (stream) params["stream"] = true;

        const workloadId = this.workloadId ?? cfg.workload_id ?? undefined;

        return {
            schema: "mvgc.action_request.v2",
            request_id: crypto.randomUUID(),
            org_id: "",
            caller_id: "langchain",
            workload_id: workloadId ?? "",
            ingress_mode: "explicit_action_request",
            action: {
                type: "llm_chat",
                method: "POST",
                target_host: route.target_host,
                target_path: targetPath,
                params,
            },
            attribution: {
                project_id: this.projectId ?? cfg.project_id ?? undefined,
                customer_id: this.customerId ?? cfg.customer_id ?? undefined,
                account_id: this.accountId ?? cfg.account_id ?? undefined,
                labels: this._effectiveLabels(cfg),
            },
        };
    }

    private _requestHeaders(cfg: AiGatewayConfig): Record<string, string> {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (cfg.gateway_token) headers["Authorization"] = `Bearer ${cfg.gateway_token}`;
        return headers;
    }

    async _generate(
        messages: BaseMessage[],
        _options: this["ParsedCallOptions"],
        _runManager?: CallbackManagerForLLMRun,
    ): Promise<ChatResult> {
        const cfg = this._getConfig();
        const actionRequest = this._buildActionRequest(messages, cfg, false);

        let response: Response;
        try {
            response = await fetch(`${cfg.gateway_url}/v1/actions:execute`, {
                method: "POST",
                headers: this._requestHeaders(cfg),
                body: JSON.stringify(actionRequest),
                signal: AbortSignal.timeout(cfg.timeout * 1000),
            });
        } catch (err: unknown) {
            throw new GatewayError(
                `Gateway connection failed: ${err instanceof Error ? err.message : String(err)}`,
            );
        }

        let data: Record<string, unknown>;
        try {
            data = (await response.json()) as Record<string, unknown>;
        } catch {
            throw new GatewayError(`Invalid JSON from gateway (HTTP ${response.status})`);
        }

        if (data["decision"] === "deny" || response.status === 403) {
            const reason = String(
                data["reason"] ?? data["message"] ?? data["error"] ?? `HTTP ${response.status}`,
            );
            const err = new PolicyDeniedError(reason);
            err.reason = reason;
            err.trace = data["trace"];
            throw err;
        }

        if (response.status === 429) throw new GatewayError("Request rate limited by gateway");
        if (response.status >= 400) {
            throw new GatewayError(
                `Gateway returned HTTP ${response.status}: ${JSON.stringify(data)}`,
            );
        }

        const result = data["result"] as Record<string, unknown> | undefined;
        if (!result) throw new GatewayError("No 'result' field in gateway response");

        const body = result["body"] as Record<string, unknown> | undefined;
        if (!body) throw new GatewayError("No 'body' field in connector result");

        const upstreamStatus = (result["status_code"] as number | undefined) ?? 200;
        if (upstreamStatus >= 400) {
            const errObj = (body["error"] as { message?: string } | undefined) ?? {};
            const msg =
                errObj.message ??
                (body["message"] as string | undefined) ??
                JSON.stringify(body);
            throw new GatewayError(
                `Upstream ${this.provider} returned HTTP ${upstreamStatus}: ${msg}`,
            );
        }

        const route = PROVIDER_ROUTES[this.provider];
        let aiMessage: AIMessage;
        if (route.format === "openai") aiMessage = parseOpenAIBody(body);
        else if (route.format === "anthropic") aiMessage = parseAnthropicBody(body);
        else aiMessage = parseGeminiBody(body);

        const text = typeof aiMessage.content === "string" ? aiMessage.content : "";
        return {
            generations: [
                {
                    message: aiMessage,
                    text,
                    generationInfo: {
                        record_id: data["record_id"],
                        metering: data["metering"],
                        provider: this.provider,
                        model: this.model,
                    },
                },
            ],
        };
    }

    async *_stream(
        messages: BaseMessage[],
        _options: this["ParsedCallOptions"],
        runManager?: CallbackManagerForLLMRun,
    ): AsyncGenerator<ChatGenerationChunk> {
        const cfg = this._getConfig();
        const route = PROVIDER_ROUTES[this.provider];
        const actionRequest = this._buildActionRequest(messages, cfg, true);

        let response: Response;
        try {
            response = await fetch(`${cfg.gateway_url}/v1/actions:execute`, {
                method: "POST",
                headers: this._requestHeaders(cfg),
                body: JSON.stringify(actionRequest),
            });
        } catch (err: unknown) {
            throw new GatewayError(
                `Gateway connection failed: ${err instanceof Error ? err.message : String(err)}`,
            );
        }

        if (!response.ok) {
            let errData: unknown;
            try { errData = await response.json(); } catch { errData = undefined; }
            if (response.status === 403) {
                const d = (errData as Record<string, unknown> | undefined) ?? {};
                const reason = String(d["reason"] ?? d["message"] ?? `HTTP ${response.status}`);
                const err = new PolicyDeniedError(reason);
                err.reason = reason;
                throw err;
            }
            throw new GatewayError(`Gateway returned HTTP ${response.status}`);
        }

        const responseBody = response.body;
        if (!responseBody) throw new GatewayError("Empty response body on streaming request");

        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let recordId: string | undefined;
        let metering: unknown;
        let done = false;

        try {
            while (!done) {
                const { done: streamDone, value } = await reader.read();
                if (streamDone) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data: ")) {
                        continue;
                    }
                    const payload = trimmed.slice(6).trim();
                    if (payload === "[DONE]") {
                        done = true;
                        break;
                    }

                    let chunk: Record<string, unknown>;
                    try { chunk = JSON.parse(payload) as Record<string, unknown>; }
                    catch { continue; }

                    if (chunk["type"] === "mvgc_metering") {
                        metering = chunk["metering"];
                        if (!recordId && typeof chunk["record_id"] === "string") {
                            recordId = chunk["record_id"];
                        }
                        continue;
                    }

                    if (chunk["type"] === "message_stop") {
                        done = true;
                        break;
                    }

                    const text = extractStreamText(route.format, chunk);
                    if (text) {
                        const genChunk = new ChatGenerationChunk({
                            message: new AIMessageChunk({ content: text }),
                            text,
                        });
                        if (runManager) await runManager.handleLLMNewToken(text);
                        yield genChunk;
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        yield new ChatGenerationChunk({
            message: new AIMessageChunk({ content: "" }),
            text: "",
            generationInfo: {
                record_id: recordId,
                metering,
                provider: this.provider,
                model: this.model,
            },
        });
    }
}
