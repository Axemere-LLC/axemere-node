/**
 * Example 05: Streaming Responses
 *
 * Demonstrates:
 * - Streaming a response from AiGatewayClient.execute({ stream: true })
 * - Iterating the AsyncIterable<StreamChunk> and printing deltas as they arrive
 * - Reading metering from the final chunk
 * - Streaming from Anthropic proxy mode via anthropicClient() for comparison
 *
 * Run:
 *   pnpm run:05
 *   # or: npx ts-node 05_streaming.ts
 */

import dotenv from "dotenv";
import { AiGatewayConfig, AiGatewayClient } from "@axemere/gateway";
import { anthropicClient } from "@axemere/gateway-anthropic";

async function demoClientStreaming(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- AiGatewayClient streaming (OpenAI gpt-4o-mini) ---");
    const client = new AiGatewayClient(cfg);

    const stream = await client.execute({
        messages: [{ role: "user", content: "Write a short three-sentence story about a robot learning to paint." }],
        provider: "openai",
        model: "gpt-4o-mini",
        max_tokens: 256,
        stream: true,
    });

    process.stdout.write("Response: ");
    for await (const chunk of stream) {
        if (chunk.content) {
            process.stdout.write(chunk.content);
        }
        if (chunk.is_final) {
            console.log(); // newline after stream
            if (chunk.metering) {
                console.log(`Metering: cost=${chunk.metering.cost_usd} tokens_in=${chunk.metering.tokens_in} tokens_out=${chunk.metering.tokens_out}`);
            }
            if (chunk.record_id) {
                console.log(`Record ID: ${chunk.record_id}`);
            }
        }
    }
}

async function demoAnthropicStreaming(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Anthropic SDK proxy streaming (claude-haiku-4-5-20251001) ---");
    const client = anthropicClient(cfg);

    // Use the Anthropic SDK's streaming API — messages.stream() returns a helper
    // that emits text events and collects the final message.
    const stream = client.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: "Write a short three-sentence story about an AI poet." }],
    });

    process.stdout.write("Response: ");
    stream.on("text", (text: string) => {
        process.stdout.write(text);
    });

    const finalMsg = await stream.finalMessage();
    console.log(); // newline after stream
    console.log(`Tokens: in=${finalMsg.usage.input_tokens} out=${finalMsg.usage.output_tokens}`);
}

function isConnectionError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const cause = err instanceof Error && err.cause instanceof Error
        ? err.cause.message.toLowerCase()
        : "";
    return (
        msg.includes("econnrefused") ||
        msg.includes("fetch failed") ||
        msg.includes("connection error") ||
        cause.includes("econnrefused")
    );
}

async function main(): Promise<void> {
    dotenv.config();

    const cfg = new AiGatewayConfig();
    console.log(`Gateway: ${cfg.gateway_url}`);
    console.log(`Workload: ${cfg.workload_id}  Project: ${cfg.project_id}`);

    try {
        await demoClientStreaming(cfg);
        await demoAnthropicStreaming(cfg);
    } catch (err) {
        if (isConnectionError(err)) {
            console.log(`\nConnectivity error: ${err instanceof Error ? err.message : err}`);
            console.log("Is the Axemere gateway running? Try: docker compose up -d");
            process.exit(0);
        }
        console.error(`\nError: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
