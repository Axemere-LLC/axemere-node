/**
 * Example 03: Anthropic SDK Drop-in Replacement
 *
 * Demonstrates:
 * - Using anthropicClient() from @axemere/gateway-anthropic as a drop-in for Anthropic
 * - Single message creation routed through the Axemere gateway
 * - Multi-turn conversation with message history
 * - Error handling for connectivity and policy errors
 *
 * anthropicClient() sets baseURL = cfg.proxyUrl("anthropic"), encoding attribution
 * fields in the URL path so every request is attributed automatically.
 *
 * Run:
 *   pnpm run:03
 *   # or: npx ts-node 03_anthropic_sdk.ts
 */

import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { AiGatewayConfig } from "@axemere/gateway";
import { anthropicClient } from "@axemere/gateway-anthropic";

function extractText(content: Anthropic.ContentBlock[]): string {
    const block = content.find(b => b.type === "text");
    return block?.type === "text" ? block.text : "[no text content]";
}

async function demoSingleMessage(client: Anthropic): Promise<void> {
    console.log("\n--- Single message ---");
    const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 128,
        messages: [{ role: "user", content: "What is the capital of France? Answer in one sentence." }],
    });
    console.log(`Response: ${extractText(response.content)}`);
    console.log(`Model: ${response.model}  Stop reason: ${response.stop_reason}`);
}

async function demoMultiTurn(client: Anthropic): Promise<void> {
    console.log("\n--- Multi-turn conversation ---");
    const messages: Anthropic.MessageParam[] = [
        { role: "user", content: "Name three planets in the solar system." },
    ];

    const first = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages,
    });
    const assistantReply = extractText(first.content);
    console.log(`Round 1 -- Assistant: ${assistantReply}`);

    messages.push({ role: "assistant", content: assistantReply });
    messages.push({ role: "user", content: "Which of those is closest to the Sun?" });

    const second = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages,
    });
    console.log(`Round 2 -- Assistant: ${extractText(second.content)}`);
}

function isConnectionError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    return (
        msg.includes("econnrefused") ||
        msg.includes("connection error") ||
        msg.includes("fetch failed") ||
        (msg.includes("connect") && msg.includes("refused"))
    );
}

async function main(): Promise<void> {
    dotenv.config();

    const cfg = new AiGatewayConfig();
    console.log(`Gateway: ${cfg.gateway_url}`);
    console.log(`Workload: ${cfg.workload_id}  Project: ${cfg.project_id}`);
    console.log(`Proxy URL: ${cfg.proxyUrl("anthropic")}`);

    const client = anthropicClient(cfg);

    try {
        await demoSingleMessage(client);
        await demoMultiTurn(client);
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
