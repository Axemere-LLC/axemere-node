/**
 * Example 10: Gateway Target Routing Modes
 *
 * Explains and demonstrates the three ways the gateway determines where to forward
 * a proxied request, in priority order:
 *
 *   1. /proxy/{provider}/ path prefix — zero-config for fixed-host providers
 *      (uses raw OpenAI SDK with baseURL = cfg.proxyUrl("openai"))
 *   2. X-MVGC-Target-Host header — explicit override, works for any host
 *      (raw fetch with X-MVGC-Target-Host: api.openai.com)
 *   3. Azure OpenAI — customer-specific hostname, no static path-prefix
 *      (cfg.proxyUrl("azure_openai") + X-MVGC-Target-Host from AXEMERE_AZURE_ENDPOINT)
 *
 * Provider path-prefix support matrix:
 *   openai     → /proxy/openai/      → api.openai.com
 *   anthropic  → /proxy/anthropic/   → api.anthropic.com
 *   cohere     → /proxy/cohere/      → api.cohere.com
 *   gemini     → /proxy/gemini/      → generativelanguage.googleapis.com
 *   azure      → NOT SUPPORTED via path-prefix (customer-specific hostname)
 *
 * Required env vars:
 *   AXEMERE_GATEWAY_URL=http://localhost:7080
 *   AXEMERE_WORKLOAD_ID=wl-prod-app-1
 *
 * For Mode 3 (Azure):
 *   AXEMERE_AZURE_ENDPOINT=<your-resource>.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
 *
 * Run:
 *   pnpm run:10
 *   # or: npx ts-node 10_routing_modes.ts
 */

import dotenv from "dotenv";
import OpenAI from "openai";
import { AiGatewayConfig } from "@axemere/gateway";

// ---------------------------------------------------------------------------
// Mode 1: Path-prefix routing (/proxy/{provider}/)
// ---------------------------------------------------------------------------

async function demoPathPrefix(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n=== Mode 1: Path-prefix routing ===");
    console.log(`SDK base_url -> ${cfg.proxyUrl("openai") + "v1/"}  =>  api.openai.com`);

    // cfg.proxyUrl("openai") returns the attribution-encoded proxy prefix, e.g.
    //   http://localhost:7080/proxy/openai/w/wl-1/p/proj-1/
    //
    // The OpenAI TypeScript SDK appends "chat/completions" (no leading /v1) to
    // the baseURL. We append "v1/" ourselves so the full upstream path becomes
    // /proxy/openai/w/…/v1/chat/completions, which the gateway strips to
    // /v1/chat/completions before forwarding to api.openai.com.
    //
    // Using the raw OpenAI SDK here (not openaiClient()) to illustrate what
    // cfg.proxyUrl() builds and how it maps to a real SDK baseURL.
    const client = new OpenAI({
        baseURL: cfg.proxyUrl("openai") + "v1/",
        apiKey: cfg.gateway_token || "axemere-gateway",
    });

    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages: [{ role: "user", content: "Say 'path-prefix routing works' in one sentence." }],
    });
    console.log(`Response: ${response.choices[0].message.content}`);
}

// ---------------------------------------------------------------------------
// Mode 2: Explicit X-MVGC-Target-Host header
// ---------------------------------------------------------------------------

async function demoExplicitTargetHost(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n=== Mode 2: Explicit X-MVGC-Target-Host header ===");
    console.log("Header: X-MVGC-Target-Host: api.openai.com  (explicit override)");

    // X-MVGC-Target-Host is the highest-priority routing signal — it overrides any
    // path-prefix provider resolution. Useful for custom endpoints, self-hosted models,
    // Azure OpenAI, or any host not in the provider registry.
    const url = `${cfg.gateway_url}/v1/chat/completions`;
    console.log(`POST ${url}`);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-MVGC-Workload-ID": cfg.workload_id,
        "X-MVGC-Target-Host": "api.openai.com",
    };
    if (cfg.gateway_token) headers["Authorization"] = `Bearer ${cfg.gateway_token}`;

    const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 64,
            messages: [{ role: "user", content: "Say 'explicit routing works' in one sentence." }],
        }),
    });

    if (response.ok) {
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        console.log(`Response: ${data.choices?.[0]?.message?.content ?? "[no content]"}`);
    } else {
        const text = await response.text();
        console.log(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
}

// ---------------------------------------------------------------------------
// Mode 3: Azure OpenAI — X-MVGC-Target-Host from AXEMERE_AZURE_ENDPOINT
// ---------------------------------------------------------------------------

async function demoAzure(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n=== Mode 3: Azure OpenAI (X-MVGC-Target-Host from AXEMERE_AZURE_ENDPOINT) ===");

    const azureEndpoint = process.env["AXEMERE_AZURE_ENDPOINT"] ?? "";
    if (!azureEndpoint) {
        console.log("AXEMERE_AZURE_ENDPOINT not set — skipping Azure demo.");
        console.log("Set AXEMERE_AZURE_ENDPOINT=<your-resource>.openai.azure.com to run this section.");
        return;
    }

    const deployment = process.env["AZURE_OPENAI_DEPLOYMENT"] ?? "gpt-4o-mini";
    console.log(`Azure endpoint: ${azureEndpoint}  Deployment: ${deployment}`);
    console.log(`Setting X-MVGC-Target-Host: ${azureEndpoint}`);

    // Azure uses customer-specific hostnames — no single static path-prefix exists.
    // We use cfg.proxyUrl("azure_openai") to build the gateway URL, then add
    // X-MVGC-Target-Host so the gateway knows where to forward the request.
    //
    // In a production integration, the Azure OpenAI SDK TypeScript client would be
    // configured with baseURL = cfg.proxyUrl("azure_openai") + azure_endpoint header.
    const proxyUrl = cfg.proxyUrl("azure_openai");
    const url = `${proxyUrl}openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`;
    console.log(`POST ${url}`);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-MVGC-Workload-ID": cfg.workload_id,
        "X-MVGC-Target-Host": azureEndpoint,
    };
    if (cfg.gateway_token) headers["Authorization"] = `Bearer ${cfg.gateway_token}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                messages: [{ role: "user", content: "Say 'Azure routing works' in one sentence." }],
                max_tokens: 64,
            }),
        });

        if (response.ok) {
            const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
            console.log(`Response: ${data.choices?.[0]?.message?.content ?? "[no content]"}`);
        } else {
            const text = await response.text();
            // A 403 credential-not-found is expected if Azure isn't configured in the gateway.
            if (response.status === 403 && text.toLowerCase().includes("credential")) {
                console.log("Azure credential not configured in this gateway — skipping.");
                console.log("Add an Azure credential to the gateway to enable this section.");
            } else {
                console.log(`HTTP ${response.status}: ${text.slice(0, 200)}`);
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes("credential") || msg.includes("credential not found")) {
            console.log("Azure credential not configured in this gateway — skipping.");
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
        await demoPathPrefix(cfg);
        await demoExplicitTargetHost(cfg);
        await demoAzure(cfg);
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
