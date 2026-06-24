import { AiGatewayClient } from "./client";
import { AiGatewayConfig } from "./config";
import {
    GatewayError,
    PolicyDeniedError,
    QuotaExceededError,
    GatewayTimeoutError,
} from "./errors";

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

type MockFetchImpl = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function mockFetch(impl: MockFetchImpl): jest.SpyInstance {
    return jest
        .spyOn(global, "fetch" as keyof typeof global)
        .mockImplementation(impl as typeof fetch);
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

// ---------------------------------------------------------------------------

afterEach(() => jest.restoreAllMocks());

const baseConfig = new AiGatewayConfig({
    gateway_url: "http://localhost:7080",
    gateway_token: "test_tok",
});

describe("AiGatewayClient — validation", () => {
    const client = new AiGatewayClient(baseConfig);

    it("throws GatewayError when provider is missing", async () => {
        await expect(
            client.execute({ messages: [{ role: "user", content: "hi" }] }),
        ).rejects.toThrow(GatewayError);
    });

    it("throws GatewayError when model is missing", async () => {
        await expect(
            client.execute({
                messages: [{ role: "user", content: "hi" }],
                provider: "openai",
            }),
        ).rejects.toThrow(GatewayError);
    });

    it("throws GatewayError for unknown provider", async () => {
        await expect(
            client.execute({
                messages: [{ role: "user", content: "hi" }],
                provider: "unknown_provider",
                model: "some-model",
            }),
        ).rejects.toThrow(GatewayError);
    });
});

describe("AiGatewayClient — successful response (OpenAI)", () => {
    it("extracts content from OpenAI choices", async () => {
        mockFetch(() =>
            jsonResponse({
                decision: "allow",
                record_id: "rec_1",
                record_hash: "abc123",
                metering: { cost_usd: "0.001", tokens_in: 10, tokens_out: 20 },
                result: {
                    status_code: 200,
                    body: {
                        model: "gpt-4o",
                        choices: [{ message: { content: "Hello!" } }],
                    },
                },
            }),
        );

        const client = new AiGatewayClient(baseConfig);
        const res = await client.execute({
            messages: [{ role: "user", content: "hi" }],
            provider: "openai",
            model: "gpt-4o",
        });

        expect(res.content).toBe("Hello!");
        expect(res.record_id).toBe("rec_1");
        expect(res.record_hash).toBe("abc123");
        expect(res.provider).toBe("openai");
        expect(res.metering.tokens_in).toBe(10);
    });
});

describe("AiGatewayClient — successful response (Anthropic)", () => {
    it("extracts content from Anthropic content array", async () => {
        mockFetch(() =>
            jsonResponse({
                decision: "allow",
                record_id: "rec_2",
                metering: { cost_usd: "0.002", tokens_in: 5, tokens_out: 15 },
                result: {
                    status_code: 200,
                    body: {
                        model: "claude-3-5-sonnet-20241022",
                        content: [{ type: "text", text: "Hi there!" }],
                    },
                },
            }),
        );

        const client = new AiGatewayClient(baseConfig);
        const res = await client.execute({
            messages: [{ role: "user", content: "hi" }],
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
        });

        expect(res.content).toBe("Hi there!");
        expect(res.record_id).toBe("rec_2");
    });
});

describe("AiGatewayClient — error mapping", () => {
    const client = new AiGatewayClient(baseConfig);
    const params = {
        messages: [{ role: "user", content: "hi" }],
        provider: "openai",
        model: "gpt-4o",
    };

    it("throws PolicyDeniedError on decision=deny", async () => {
        mockFetch(() =>
            jsonResponse(
                {
                    decision: "deny",
                    reason: "policy violation",
                    record_id: "rec_deny",
                    trace: { bundle_id: "bun_1" },
                },
                200,
            ),
        );
        await expect(client.execute(params)).rejects.toThrow(PolicyDeniedError);
        try {
            await client.execute(params);
        } catch (err) {
            expect(err).toBeInstanceOf(PolicyDeniedError);
            const e = err as PolicyDeniedError;
            expect(e.reason).toBe("policy violation");
            expect(e.record_id).toBe("rec_deny");
        }
    });

    it("throws QuotaExceededError on HTTP 429 with quota_exceeded", async () => {
        mockFetch(() =>
            jsonResponse(
                { error: "quota_exceeded", upgrade_url: "https://axemere.ai/upgrade", retry_after: 60 },
                429,
            ),
        );
        await expect(client.execute(params)).rejects.toThrow(QuotaExceededError);
        try {
            await client.execute(params);
        } catch (err) {
            const e = err as QuotaExceededError;
            expect(e.upgrade_url).toBe("https://axemere.ai/upgrade");
            expect(e.retry_after).toBe(60);
        }
    });

    it("throws GatewayTimeoutError on HTTP 504", async () => {
        mockFetch(() => new Response("gateway timeout", { status: 504 }));
        await expect(client.execute(params)).rejects.toThrow(GatewayTimeoutError);
    });

    it("throws GatewayError on non-OK HTTP status", async () => {
        mockFetch(() => jsonResponse({ message: "internal error" }, 500));
        const err = await client.execute(params).catch((e) => e as GatewayError);
        expect(err).toBeInstanceOf(GatewayError);
        expect(err.status_code).toBe(500);
    });

    it("throws GatewayError when provider returns error status", async () => {
        mockFetch(() =>
            jsonResponse({
                decision: "allow",
                record_id: "rec_err",
                metering: { cost_usd: "0", tokens_in: 0, tokens_out: 0 },
                result: { status_code: 401, body: { error: "invalid api key" } },
            }),
        );
        await expect(client.execute(params)).rejects.toThrow(GatewayError);
    });
});

describe("AiGatewayClient — wire request", () => {
    it("sends Authorization header when gateway_token is set", async () => {
        let capturedHeaders: Record<string, string> = {};
        mockFetch((_, init) => {
            capturedHeaders = Object.fromEntries(
                Object.entries((init?.headers as Record<string, string>) ?? {}),
            );
            return jsonResponse({
                decision: "allow",
                record_id: "rec_hdr",
                metering: { cost_usd: "0", tokens_in: 0, tokens_out: 0 },
                result: {
                    status_code: 200,
                    body: { choices: [{ message: { content: "ok" } }] },
                },
            });
        });

        const client = new AiGatewayClient(
            new AiGatewayConfig({ gateway_url: "http://localhost:7080", gateway_token: "my_tok" }),
        );
        await client.execute({
            messages: [{ role: "user", content: "hi" }],
            provider: "openai",
            model: "gpt-4o",
        });
        expect(capturedHeaders["Authorization"]).toBe("Bearer my_tok");
    });

    it("omits Authorization header when gateway_token is empty", async () => {
        let capturedHeaders: Record<string, string> = {};
        mockFetch((_, init) => {
            capturedHeaders = Object.fromEntries(
                Object.entries((init?.headers as Record<string, string>) ?? {}),
            );
            return jsonResponse({
                decision: "allow",
                record_id: "rec_no_auth",
                metering: { cost_usd: "0", tokens_in: 0, tokens_out: 0 },
                result: {
                    status_code: 200,
                    body: { choices: [{ message: { content: "ok" } }] },
                },
            });
        });

        const noTokenConfig = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = new AiGatewayClient(noTokenConfig);
        await client.execute({
            messages: [{ role: "user", content: "hi" }],
            provider: "openai",
            model: "gpt-4o",
        });
        expect(capturedHeaders["Authorization"]).toBeUndefined();
    });

    it("includes attribution when project_id is set", async () => {
        let capturedBody: Record<string, unknown> = {};
        mockFetch((_, init) => {
            capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
            return jsonResponse({
                decision: "allow",
                record_id: "rec_attr",
                metering: { cost_usd: "0", tokens_in: 0, tokens_out: 0 },
                result: {
                    status_code: 200,
                    body: { choices: [{ message: { content: "ok" } }] },
                },
            });
        });

        const client = new AiGatewayClient(
            new AiGatewayConfig({ gateway_url: "http://localhost:7080" }),
        );
        await client.execute({
            messages: [{ role: "user", content: "hi" }],
            provider: "openai",
            model: "gpt-4o",
            project_id: "proj_xyz",
        });
        const attribution = capturedBody["attribution"] as Record<string, unknown>;
        expect(attribution?.["project_id"]).toBe("proj_xyz");
    });
});
