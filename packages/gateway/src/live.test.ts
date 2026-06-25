/**
 * Live integration tests — require real gateway credentials.
 *
 * These tests run against the managed Axemere AI Gateway and are skipped
 * automatically when AXEMERE_GATEWAY_TOKEN is not set. To run them:
 *
 *   source tests/.env
 *   cd node && pnpm --filter @axemere/gateway test
 *
 * The gateway URL defaults to https://us.gw.axemere.ai unless
 * AXEMERE_GATEWAY_URL is set.
 */

import { AiGatewayClient, AiGatewayConfig, GatewayError } from "./index";

const GATEWAY_TOKEN = process.env["AXEMERE_GATEWAY_TOKEN"];
const GATEWAY_URL = process.env["AXEMERE_GATEWAY_URL"] ?? "https://us.gw.axemere.ai";
const LIVE = !!GATEWAY_TOKEN;

const describeLive = LIVE ? describe : describe.skip;
const PROVIDER = "anthropic";
const MODEL = "claude-haiku-4-5-20251001";

function makeClient(token?: string): AiGatewayClient {
    const cfg = new AiGatewayConfig({
        gateway_url: GATEWAY_URL,
        gateway_token: token ?? GATEWAY_TOKEN ?? "",
    });
    return new AiGatewayClient(cfg);
}

describeLive("Live: basic completion", () => {
    it("returns non-empty content from the managed gateway", async () => {
        const client = makeClient();
        const result = await client.execute({
            provider: PROVIDER,
            model: MODEL,
            messages: [{ role: "user", content: "Reply with the single word: pong" }],
            max_tokens: 10,
        });

        expect(result.content).toBeTruthy();
        expect(result.record_id).toBeTruthy();
        expect(result.metering).toBeDefined();
        expect(result.metering.tokens_out).toBeGreaterThan(0);
    }, 30000);
});

describeLive("Live: streaming", () => {
    it("delivers content chunks and a final chunk with metering", async () => {
        const client = makeClient();
        const stream = await client.execute({
            stream: true,
            provider: PROVIDER,
            model: MODEL,
            messages: [{ role: "user", content: "Count to three: 1, 2, 3." }],
            max_tokens: 20,
        });

        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        const contentChunks = chunks.filter((c) => !c.is_final);
        const finalChunks = chunks.filter((c) => c.is_final);

        expect(contentChunks.length).toBeGreaterThan(0);
        const assembled = contentChunks.map((c) => c.content).join("");
        expect(assembled).toBeTruthy();

        expect(finalChunks.length).toBeGreaterThan(0);
        const final = finalChunks[finalChunks.length - 1];
        expect(final.metering).toBeDefined();
    }, 30000);
});

describeLive("Live: error on bad token", () => {
    it("throws GatewayError when the token is invalid", async () => {
        const client = makeClient("axm_k_invalid_token_for_testing");

        await expect(
            client.execute({
                provider: PROVIDER,
                model: MODEL,
                messages: [{ role: "user", content: "hi" }],
                max_tokens: 5,
            }),
        ).rejects.toBeInstanceOf(GatewayError);
    }, 15000);
});
