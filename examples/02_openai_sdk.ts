/**
 * Example 02: OpenAI SDK Drop-in Replacement
 *
 * Demonstrates:
 * - Using openaiClient() from @axemere/gateway-openai as a drop-in for openai.OpenAI
 * - Single chat completion routed through the Axemere gateway
 * - Multi-turn conversation with message history
 * - Error handling for connectivity and policy errors
 *
 * openaiClient() sets baseURL = cfg.proxyUrl("openai"), which encodes workload_id,
 * project_id, account_id, and customer_id in the URL path so every request is
 * attributed automatically — no per-request headers or middleware needed.
 *
 * Run:
 *   pnpm run:02
 *   # or: npx ts-node 02_openai_sdk.ts
 */

import dotenv from "dotenv";
import OpenAI from "openai";
import { AiGatewayConfig } from "@axemere/gateway";
import { openaiClient } from "@axemere/gateway-openai";

async function demoSingleCompletion(client: OpenAI): Promise<void> {
    console.log("\n--- Single chat completion ---");
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 128,
        messages: [{ role: "user", content: "What is 2 + 2? Answer in one sentence." }],
    });
    console.log(`Response: ${response.choices[0].message.content}`);
    console.log(`Model: ${response.model}  Tokens: ${response.usage?.total_tokens ?? "?"}`);
}

async function demoMultiTurn(client: OpenAI): Promise<void> {
    console.log("\n--- Multi-turn conversation ---");
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "user", content: "Name the three primary colors." },
    ];

    const first = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages,
    });
    const assistantReply = first.choices[0].message.content ?? "";
    console.log(`Round 1 -- Assistant: ${assistantReply}`);

    messages.push({ role: "assistant", content: assistantReply });
    messages.push({ role: "user", content: "Which of those do you get by mixing red and blue?" });

    const second = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages,
    });
    console.log(`Round 2 -- Assistant: ${second.choices[0].message.content}`);
}

function isConnectionError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    return (
        msg.includes("econnrefused") ||
        msg.includes("connection error") ||
        msg.includes("fetch failed") ||
        msg.includes("connect") && msg.includes("refused")
    );
}

async function main(): Promise<void> {
    dotenv.config();

    const cfg = new AiGatewayConfig();
    console.log(`Gateway: ${cfg.gateway_url}`);
    console.log(`Workload: ${cfg.workload_id}  Project: ${cfg.project_id}`);
    console.log(`Proxy URL: ${cfg.proxyUrl("openai")}`);

    const client = openaiClient(cfg);

    try {
        await demoSingleCompletion(client);
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
