import { AiGatewayConfig } from "@axemere/gateway";
import { ChatAiGateway, aiGatewayOpenAIClient, aiGatewayAnthropicClient } from "./index";

describe("ChatAiGateway — construction", () => {
    it("can be instantiated with a valid provider", () => {
        expect(
            () =>
                new ChatAiGateway({
                    provider: "openai",
                    model: "gpt-4o-mini",
                    config: new AiGatewayConfig({ gateway_url: "http://localhost:7080" }),
                }),
        ).not.toThrow();
    });

    it("throws on unsupported provider", () => {
        expect(
            () =>
                new ChatAiGateway({
                    provider: "not-a-real-provider",
                    model: "some-model",
                }),
        ).toThrow(/Unsupported provider/);
    });

    it("defaults maxTokens to 256", () => {
        const llm = new ChatAiGateway({ provider: "openai", model: "gpt-4o-mini" });
        expect(llm.maxTokens).toBe(256);
    });

    it("respects caller-supplied maxTokens", () => {
        const llm = new ChatAiGateway({ provider: "openai", model: "gpt-4o-mini", maxTokens: 1024 });
        expect(llm.maxTokens).toBe(1024);
    });

    it("_llmType returns 'axemere-gateway'", () => {
        const llm = new ChatAiGateway({ provider: "anthropic", model: "claude-haiku-4-5-20251001" });
        expect(llm._llmType()).toBe("axemere-gateway");
    });

    it("supports all documented providers", () => {
        const providers = [
            "openai", "anthropic", "mistral", "google",
            "xai", "deepseek", "groq", "together",
            "fireworks", "perplexity", "openrouter", "cohere",
        ];
        for (const provider of providers) {
            expect(
                () => new ChatAiGateway({ provider, model: "some-model" }),
            ).not.toThrow();
        }
    });
});

describe("ChatAiGateway — _generate wire body", () => {
    function mockFetch(body: unknown, status = 200) {
        return jest.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify(body), {
                status,
                headers: { "Content-Type": "application/json" },
            }),
        );
    }

    afterEach(() => jest.restoreAllMocks());

    const cfg = new AiGatewayConfig({
        gateway_url: "http://localhost:7080",
        gateway_token: "tok_test",
    });

    it("sends correct action type and target_host for openai", async () => {
        let capturedBody: Record<string, unknown> = {};
        jest.spyOn(globalThis, "fetch").mockImplementation((_, init) => {
            capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        decision: "allow",
                        record_id: "rec_1",
                        metering: {},
                        result: {
                            status_code: 200,
                            body: { choices: [{ message: { content: "Hello!" } }] },
                        },
                    }),
                    { status: 200 },
                ),
            );
        });

        const llm = new ChatAiGateway({ provider: "openai", model: "gpt-4o-mini", config: cfg });
        await llm.invoke("hi");

        const action = capturedBody["action"] as Record<string, unknown>;
        expect(action["target_host"]).toBe("api.openai.com");
        expect(action["target_path"]).toBe("/v1/chat/completions");
        expect((action["params"] as Record<string, unknown>)["model"]).toBe("gpt-4o-mini");
    });

    it("sends correct target_host for anthropic", async () => {
        let capturedBody: Record<string, unknown> = {};
        jest.spyOn(globalThis, "fetch").mockImplementation((_, init) => {
            capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        decision: "allow",
                        record_id: "rec_2",
                        metering: {},
                        result: {
                            status_code: 200,
                            body: { content: [{ type: "text", text: "Hi!" }] },
                        },
                    }),
                    { status: 200 },
                ),
            );
        });

        const llm = new ChatAiGateway({
            provider: "anthropic",
            model: "claude-haiku-4-5-20251001",
            config: cfg,
        });
        await llm.invoke("hi");

        const action = capturedBody["action"] as Record<string, unknown>;
        expect(action["target_host"]).toBe("api.anthropic.com");
    });

    it("throws PolicyDeniedError on decision=deny", async () => {
        mockFetch({ decision: "deny", reason: "budget exceeded", record_id: "rec_3" });
        const llm = new ChatAiGateway({ provider: "openai", model: "gpt-4o-mini", config: cfg });
        await expect(llm.invoke("hi")).rejects.toMatchObject({ reason: "budget exceeded" });
    });

    it("throws GatewayError on HTTP 500", async () => {
        mockFetch({ error: "internal" }, 500);
        const llm = new ChatAiGateway({ provider: "openai", model: "gpt-4o-mini", config: cfg });
        await expect(llm.invoke("hi")).rejects.toBeInstanceOf(Error);
    });
});

describe("proxy re-exports", () => {
    it("aiGatewayOpenAIClient is a function", () => {
        expect(typeof aiGatewayOpenAIClient).toBe("function");
    });

    it("aiGatewayAnthropicClient is a function", () => {
        expect(typeof aiGatewayAnthropicClient).toBe("function");
    });
});
