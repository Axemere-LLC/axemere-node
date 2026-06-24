/**
 * Example 06: Raw Proxy Mode with fetch
 *
 * Demonstrates:
 * - Building a gateway proxy URL with cfg.proxyUrl("openai")
 * - Making a raw fetch call directly to /proxy/openai/v1/chat/completions
 * - Using X-MVGC-Workload-ID header alongside path-encoded attribution
 * - The URL structure: /proxy/{provider}/[k/{token}/][w/{wl}/][p/{proj}/][a/{acct}/][c/{cust}/]
 *
 * Proxy mode lets any HTTP client route through the gateway without any SDK changes —
 * just point baseURL at the proxy path and optionally add gateway headers.
 *
 * Run:
 *   pnpm run:06
 *   # or: npx ts-node 06_proxy_mode.ts
 */

import dotenv from "dotenv";
import { AiGatewayConfig } from "@axemere/gateway";

async function demoProxyUrlBuilding(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Proxy URL structure ---");
    console.log(`cfg.proxyUrl("openai"):    ${cfg.proxyUrl("openai")}`);
    console.log(`cfg.proxyUrl("anthropic"): ${cfg.proxyUrl("anthropic")}`);
    console.log(`cfg.proxyUrl("cohere"):    ${cfg.proxyUrl("cohere")}`);
    console.log();
    console.log("URL segments encoded in path:");
    console.log(`  /proxy/{provider}/k/{gateway_token}/w/{workload_id}/p/{project_id}/a/{account_id}/c/{customer_id}/`);
    console.log("Segments for fields that are empty are omitted automatically.");
}

async function demoRawFetch(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Raw fetch to proxy path (OpenAI-compatible format) ---");

    // proxyUrl() returns e.g. http://localhost:7080/proxy/openai/w/wl-1/p/proj-1/
    // Append v1/chat/completions — the gateway parses attribution segments and
    // stops at the first non-label segment (v1), forwarding /v1/chat/completions
    // to api.openai.com.
    const proxyBase = cfg.proxyUrl("openai");
    const url = `${proxyBase}v1/chat/completions`;
    console.log(`POST ${url}`);

    const body = {
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages: [{ role: "user", content: "Say 'proxy mode works' in one sentence." }],
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        // X-MVGC-Workload-ID can also carry workload attribution if not in URL path.
        // Here the workload_id is already encoded in proxyBase, so the header is
        // redundant but harmless — header takes priority over path on conflict.
        "X-MVGC-Workload-ID": cfg.workload_id,
    };
    if (cfg.gateway_token) {
        headers["Authorization"] = `Bearer ${cfg.gateway_token}`;
    }

    const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        console.log(`HTTP ${response.status}: ${text.slice(0, 200)}`);
        return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    console.log(`Response: ${data.choices?.[0]?.message?.content ?? "[no content]"}`);
}

async function demoHeaderOnly(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- Header-only routing (no path attribution, explicit workload header) ---");

    // Send to the gateway root — no /proxy/ path prefix, no attribution in URL.
    // The gateway uses the X-MVGC-Workload-ID header for workload lookup.
    const url = `${cfg.gateway_url}/v1/chat/completions`;
    console.log(`POST ${url}`);
    console.log(`  X-MVGC-Workload-ID: ${cfg.workload_id}`);
    console.log(`  X-MVGC-Target-Host: api.openai.com`);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-MVGC-Workload-ID": cfg.workload_id,
        "X-MVGC-Target-Host": "api.openai.com",
    };
    if (cfg.gateway_token) {
        headers["Authorization"] = `Bearer ${cfg.gateway_token}`;
    }

    const body = {
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages: [{ role: "user", content: "Say 'header routing works' in one sentence." }],
    };

    const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        console.log(`HTTP ${response.status}: ${text.slice(0, 200)}`);
        return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    console.log(`Response: ${data.choices?.[0]?.message?.content ?? "[no content]"}`);
}

function isConnectionError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const cause = err instanceof Error && err.cause instanceof Error
        ? err.cause.message.toLowerCase()
        : "";
    return (
        msg.includes("econnrefused") ||
        msg.includes("fetch failed") ||
        cause.includes("econnrefused")
    );
}

async function main(): Promise<void> {
    dotenv.config();

    const cfg = new AiGatewayConfig();
    console.log(`Gateway: ${cfg.gateway_url}`);
    console.log(`Workload: ${cfg.workload_id}  Project: ${cfg.project_id}`);

    try {
        demoProxyUrlBuilding(cfg);
        await demoRawFetch(cfg);
        await demoHeaderOnly(cfg);
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
