/**
 * Example 01: Explicit Mode Hello World
 *
 * Demonstrates:
 * - Sending a single message to OpenAI via the gateway using AiGatewayClient
 * - Sending a single message to Anthropic via the gateway using AiGatewayClient
 * - A successful allow response: printing content and metering
 * - A policy denial (PolicyDeniedError) when project_id is missing
 *
 * Run:
 *   pnpm run:01
 *   # or: npx ts-node 01_basic_chat.ts
 */

import dotenv from "dotenv";
import { AiGatewayConfig, AiGatewayClient, PolicyDeniedError, GatewayError } from "@axemere/gateway";

async function demoOpenAI(client: AiGatewayClient): Promise<void> {
    console.log("\n--- OpenAI via gateway (explicit mode) ---");
    const response = await client.execute({
        messages: [{ role: "user", content: "What is 2 + 2? Answer in one sentence." }],
        provider: "openai",
        model: "gpt-4o-mini",
        max_tokens: 128,
    });
    console.log(`Response: ${response.content}`);
    console.log(`Record ID: ${response.record_id}`);
    console.log(`Metering: cost=${response.metering.cost_usd} tokens_in=${response.metering.tokens_in} tokens_out=${response.metering.tokens_out}`);
}

async function demoAnthropic(client: AiGatewayClient): Promise<void> {
    console.log("\n--- Anthropic via gateway (explicit mode) ---");
    const response = await client.execute({
        messages: [{ role: "user", content: "What is the capital of France? Answer in one sentence." }],
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        max_tokens: 128,
    });
    console.log(`Response: ${response.content}`);
    console.log(`Record ID: ${response.record_id}`);
    console.log(`Metering: cost=${response.metering.cost_usd} tokens_in=${response.metering.tokens_in} tokens_out=${response.metering.tokens_out}`);
}

async function demoPolicyDenial(cfg: AiGatewayConfig): Promise<void> {
    // Omit project_id to trigger a policy deny from the gateway — this is expected.
    console.log("\n--- Policy denial: missing project_id (expected) ---");
    const noProjCfg = new AiGatewayConfig({
        gateway_url: cfg.gateway_url,
        gateway_token: cfg.gateway_token,
        workload_id: cfg.workload_id,
        project_id: "",   // intentionally empty
        customer_id: cfg.customer_id,
        account_id: cfg.account_id,
    });
    const restrictedClient = new AiGatewayClient(noProjCfg);
    try {
        await restrictedClient.execute({
            messages: [{ role: "user", content: "Hello" }],
            provider: "openai",
            model: "gpt-4o-mini",
            max_tokens: 64,
        });
        console.log("ERROR: expected PolicyDeniedError but request succeeded");
    } catch (err) {
        if (err instanceof PolicyDeniedError) {
            console.log(`Gateway denied the request (expected): ${err.message}`);
            if (err.trace) {
                console.log(`  Decision trace: ${JSON.stringify(err.trace)}`);
            }
        } else if (err instanceof GatewayError) {
            console.log(`Gateway error (check gateway is running): ${err.message}`);
        } else {
            throw err;
        }
    }
}

function isConnectionError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const cause = err instanceof Error && err.cause instanceof Error
        ? err.cause.message.toLowerCase()
        : "";
    return (
        msg.includes("econnrefused") ||
        msg.includes("fetch failed") ||
        msg.includes("connection refused") ||
        msg.includes("etimedout") ||
        msg.includes("network error") ||
        cause.includes("econnrefused") ||
        cause.includes("connection refused")
    );
}

async function main(): Promise<void> {
    dotenv.config();

    const cfg = new AiGatewayConfig();
    console.log(`Gateway: ${cfg.gateway_url}`);
    console.log(`Workload: ${cfg.workload_id}  Project: ${cfg.project_id}`);

    const client = new AiGatewayClient(cfg);

    try {
        await demoOpenAI(client);
        await demoAnthropic(client);
    } catch (err) {
        if (isConnectionError(err)) {
            console.log(`\nConnectivity error: ${err instanceof Error ? err.message : err}`);
            console.log("Is the Axemere gateway running? Try: docker compose up -d");
            process.exit(0);
        }
        if (err instanceof PolicyDeniedError) {
            console.log(`\nPolicy denied: ${err.message}`);
            console.log("Check that your gateway policies allow this workload/project.");
            process.exit(1);
        }
        throw err;
    }

    await demoPolicyDenial(cfg);
}

main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
