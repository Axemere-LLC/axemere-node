/**
 * Example 04: Multi-Provider Comparison
 *
 * Demonstrates:
 * - Asking the same question to both OpenAI and Anthropic via AiGatewayClient
 * - Using cfg.setDefaults() to switch provider between calls
 * - Comparing responses and total spend across providers
 *
 * Run:
 *   pnpm run:04
 *   # or: npx ts-node 04_multi_provider.ts
 */

import dotenv from "dotenv";
import { AiGatewayConfig, AiGatewayClient } from "@axemere/gateway";

const QUESTION = "In one sentence, what is the most important principle of software engineering?";

async function askProvider(
    client: AiGatewayClient,
    provider: string,
    model: string,
    cfg: AiGatewayConfig,
): Promise<{ content: string; cost: string }> {
    cfg.setDefaults({ provider, model });
    const response = await client.execute({
        messages: [{ role: "user", content: QUESTION }],
        max_tokens: 128,
    });
    return { content: response.content, cost: response.metering.cost_usd };
}

function isConnectionError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const cause = err instanceof Error && err.cause instanceof Error
        ? err.cause.message.toLowerCase()
        : "";
    return (
        msg.includes("econnrefused") ||
        msg.includes("fetch failed") ||
        msg.includes("network error") ||
        cause.includes("econnrefused")
    );
}

async function main(): Promise<void> {
    dotenv.config();

    const cfg = new AiGatewayConfig();
    console.log(`Gateway: ${cfg.gateway_url}`);
    console.log(`Workload: ${cfg.workload_id}  Project: ${cfg.project_id}`);
    console.log(`\nQuestion: "${QUESTION}"\n`);

    const client = new AiGatewayClient(cfg);

    try {
        console.log("--- OpenAI gpt-4o-mini ---");
        const openaiResult = await askProvider(client, "openai", "gpt-4o-mini", cfg);
        console.log(`Response: ${openaiResult.content}`);
        console.log(`Cost: $${openaiResult.cost}`);

        console.log("\n--- Anthropic claude-haiku-4-5-20251001 ---");
        const anthropicResult = await askProvider(client, "anthropic", "claude-haiku-4-5-20251001", cfg);
        console.log(`Response: ${anthropicResult.content}`);
        console.log(`Cost: $${anthropicResult.cost}`);

        // Compute total spend — costs are decimal strings, parse carefully.
        const total = (parseFloat(openaiResult.cost || "0") + parseFloat(anthropicResult.cost || "0")).toFixed(6);
        console.log(`\nTotal spend for both calls: $${total}`);
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
