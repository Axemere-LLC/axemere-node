/**
 * Example 09: Path Attribution
 *
 * Demonstrates how workload_id, project_id, account_id, customer_id, and labels
 * flow through the three attribution methods:
 *
 *   1. Explicit API (AiGatewayClient) — all attribution fields in the request body
 *   2. Per-call override — override project_id for a single request
 *   3. Proxy path attribution — attribution encoded in the URL, zero-config for clients
 *
 * URL format for proxy path attribution:
 *   /proxy/{provider}[/w/{workload_id}][/p/{project_id}][/a/{account_id}][/c/{customer_id}]/
 *
 * The gateway strips all labeled segments before forwarding to the upstream provider.
 * Attribution flows automatically on every request from a client bound to that base URL.
 *
 * Priority waterfall (highest → lowest):
 *   X-MVGC-* header  >  path segment  >  workload default_attribution  >  gateway default
 *
 * Run:
 *   pnpm run:09
 *   # or: npx ts-node 09_path_attribution.ts
 */

import dotenv from "dotenv";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { AiGatewayConfig, AiGatewayClient } from "@axemere/gateway";

// ---------------------------------------------------------------------------
// Method 1: Explicit API with full attribution in the request body
// ---------------------------------------------------------------------------

async function demoExplicitAttribution(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Method 1: Explicit API — full attribution in request body ---");
    const client = new AiGatewayClient(cfg);
    const response = await client.execute({
        messages: [{ role: "user", content: "Say 'attribution works' in one sentence." }],
        provider: "openai",
        model: "gpt-4o-mini",
        max_tokens: 64,
        workload_id: cfg.workload_id,
        project_id: cfg.project_id,
        account_id: cfg.account_id,
        customer_id: cfg.customer_id,
        labels: { env: "prod", team: "ml", source: "path-attribution-example" },
    });
    console.log(`Response:  ${response.content}`);
    console.log(`Record ID: ${response.record_id}`);
    console.log(`Cost:      $${response.metering.cost_usd}`);
    console.log(`Attribution: workload=${cfg.workload_id} project=${cfg.project_id} account=${cfg.account_id} customer=${cfg.customer_id}`);
}

// ---------------------------------------------------------------------------
// Method 2: Per-call override — override project_id for one request
// ---------------------------------------------------------------------------

async function demoPerCallOverride(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Method 2: Per-call project_id override ---");

    // cfg.project_id is the default but we pass a different project_id in this call.
    const overrideProjectId = "proj-override-special";
    const client = new AiGatewayClient(cfg);
    const response = await client.execute({
        messages: [{ role: "user", content: "Say 'override works' in one sentence." }],
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        project_id: overrideProjectId,  // overrides cfg.project_id for this call only
    });
    console.log(`Response:  ${response.content}`);
    console.log(`Record ID: ${response.record_id}`);
    console.log(`Cost:      $${response.metering.cost_usd}`);
    console.log(`Attribution: project_id was overridden to '${overrideProjectId}' for this call`);
    console.log(`  cfg.project_id is still '${cfg.project_id}' (unchanged)`);
}

// ---------------------------------------------------------------------------
// Method 3: Proxy path attribution — attribution encoded in the URL
// ---------------------------------------------------------------------------

async function demoOpenAIPathAttribution(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Method 3a: OpenAI SDK with path attribution ---");

    // OpenAI SDK appends /chat/completions (no /v1 prefix) to baseURL, so /v1 must
    // be included in the base URL after the attribution labels. The gateway parses
    // labeled segments and stops at 'v1', forwarding /v1/chat/completions upstream.
    const baseURL = `${cfg.gateway_url}/proxy/openai/w/${cfg.workload_id}/p/${cfg.project_id}/v1`;
    console.log(`Base URL: ${baseURL}`);
    console.log("Attribution is encoded in the URL — no per-request headers needed.");

    const client = new OpenAI({ baseURL, apiKey: "any-value" });
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages: [{ role: "user", content: "Say 'path attribution works' in one sentence." }],
    });
    console.log(`Response: ${response.choices[0].message.content}`);
}

async function demoAnthropicPathAttribution(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Method 3b: Anthropic SDK with path attribution ---");

    // Anthropic SDK includes /v1 in its endpoint paths, so no /v1 suffix in baseURL.
    const baseURL = `${cfg.gateway_url}/proxy/anthropic/w/${cfg.workload_id}/p/${cfg.project_id}`;
    console.log(`Base URL: ${baseURL}`);

    const client = new Anthropic({ baseURL, apiKey: "any-value" });
    const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [{ role: "user", content: "Say 'path attribution works' in one sentence." }],
    });
    const text = response.content.find(b => b.type === "text");
    console.log(`Response: ${text?.type === "text" ? text.text : "[no text]"}`);
}

async function demoPerCustomerSaaS(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Method 3c: Per-customer SaaS pattern (customer_id in path) ---");

    // Each tenant gets its own client instance with customer_id encoded in baseURL.
    // No per-request header injection — attribution flows automatically.
    function makeClient(customerId: string): Anthropic {
        return new Anthropic({
            baseURL: `${cfg.gateway_url}/proxy/anthropic/w/${cfg.workload_id}/c/${customerId}`,
            apiKey: "any-value",
        });
    }

    const acmeClient = makeClient("cust-acme-corp");
    const globexClient = makeClient("cust-globex-ind");

    console.log(`ACME base URL:   ${cfg.gateway_url}/proxy/anthropic/w/${cfg.workload_id}/c/cust-acme-corp`);
    console.log(`Globex base URL: ${cfg.gateway_url}/proxy/anthropic/w/${cfg.workload_id}/c/cust-globex-ind`);
    console.log("Both calls are attributed to different customer_ids automatically.");

    const acmeResp = await acmeClient.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 32,
        messages: [{ role: "user", content: "Hi" }],
    });
    const globexResp = await globexClient.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 32,
        messages: [{ role: "user", content: "Hi" }],
    });

    const acmeText = acmeResp.content.find(b => b.type === "text");
    const globexText = globexResp.content.find(b => b.type === "text");
    console.log(`ACME response:   ${acmeText?.type === "text" ? acmeText.text : "[no text]"}`);
    console.log(`Globex response: ${globexText?.type === "text" ? globexText.text : "[no text]"}`);
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
    console.log(`Gateway:  ${cfg.gateway_url}`);
    console.log(`Workload: ${cfg.workload_id}  Project: ${cfg.project_id}`);

    try {
        await demoExplicitAttribution(cfg);
        await demoPerCallOverride(cfg);
        await demoOpenAIPathAttribution(cfg);
        await demoAnthropicPathAttribution(cfg);
        await demoPerCustomerSaaS(cfg);
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
