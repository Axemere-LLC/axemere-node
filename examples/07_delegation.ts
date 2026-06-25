/**
 * Example 07: Delegation Tokens
 *
 * Demonstrates:
 * - The structure of a delegation token (wire spec mvgc.delegation.v2)
 * - Creating a signed token using Node.js built-in Ed25519 (no extra deps)
 * - Including a delegation token in an explicit action request via raw fetch
 * - How the gateway enforces token scope (action type restriction)
 * - How the gateway enforces token budget constraints
 *
 * Delegation tokens let an issuing service grant a narrowed set of permissions to
 * a sub-workload or principal without handing over full credentials. In production,
 * the private key lives in the issuing governance service; the gateway is configured
 * with MVGC_DELEGATION_VERIFY_KEY set to the matching public key. This example
 * generates an ephemeral key pair for illustration — requests will be denied by a
 * real gateway unless you configure matching keys.
 *
 * Run:
 *   pnpm run:07
 *   # or: npx ts-node 07_delegation.ts
 */

import dotenv from "dotenv";
import * as crypto from "crypto";
import { randomUUID } from "crypto";
import { AiGatewayConfig } from "@axemere/gateway";

// ---------------------------------------------------------------------------
// JCS encoder (RFC 8785 minimal: sort keys recursively, compact JSON)
// ---------------------------------------------------------------------------

function sortKeys(val: unknown): unknown {
    if (val === null || typeof val !== "object") return val;
    if (Array.isArray(val)) return val.map(sortKeys);
    const obj = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
        sorted[k] = sortKeys(obj[k]);
    }
    return sorted;
}

function jcsEncode(obj: unknown): Buffer {
    return Buffer.from(JSON.stringify(sortKeys(obj)));
}

// ---------------------------------------------------------------------------
// Token creation
// ---------------------------------------------------------------------------

interface DelegationScope {
    actions_allow: string[];
    targets_allow: string[];
}

interface DelegationBudget {
    usd_max?: string;
    max_requests?: number;
}

interface DelegationToken {
    schema: string;
    org_id: string;
    workload_id: string;
    delegation_id: string;
    jti: string;
    issued_by: string;
    issued_at: string;
    expires_at: string;
    audience: string;
    scope: DelegationScope;
    budget: DelegationBudget;
    depth: number;
    sig: {
        key_id: string;
        algorithm: string;
        sig: string;
    };
}

function createDelegationToken(
    privateKey: crypto.KeyObject,
    publicKey: crypto.KeyObject,
    opts: {
        org_id?: string;
        workload_id: string;
        issued_by: string;
        audience: string;
        ttl_seconds?: number;
        actions_allow?: string[];
        targets_allow?: string[];
        usd_max?: string;
        max_requests?: number;
    },
): string {
    const ttl = opts.ttl_seconds ?? 3600;
    const now = new Date();
    const expires = new Date(now.getTime() + ttl * 1000);

    const toISOShort = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

    const unsigned: Omit<DelegationToken, "sig"> = {
        schema: "mvgc.delegation.v2",
        org_id: opts.org_id ?? "",
        workload_id: opts.workload_id,
        delegation_id: randomUUID(),
        jti: randomUUID(),
        issued_by: opts.issued_by,
        issued_at: toISOShort(now),
        expires_at: toISOShort(expires),
        audience: opts.audience,
        scope: {
            actions_allow: opts.actions_allow ?? [],
            targets_allow: opts.targets_allow ?? [],
        },
        budget: {
            ...(opts.usd_max ? { usd_max: opts.usd_max } : {}),
            ...(opts.max_requests ? { max_requests: opts.max_requests } : {}),
        },
        depth: 0,
    };

    const canonical = jcsEncode(unsigned);
    const rawSig = crypto.sign(null, canonical, privateKey);

    // Extract the 32-byte raw public key from the JWK 'x' field.
    const jwk = publicKey.export({ format: "jwk" }) as { x?: string };
    if (!jwk.x) throw new Error("Failed to export Ed25519 public key");
    const pubRaw = Buffer.from(jwk.x, "base64url");
    const keyId = pubRaw.slice(0, 8).toString("base64url").replace(/=/g, "");

    const signed: DelegationToken = {
        ...unsigned,
        sig: {
            key_id: keyId,
            algorithm: "ed25519",
            sig: rawSig.toString("base64"),
        },
    };

    return JSON.stringify(signed);
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

interface ActionBody {
    schema: string;
    org_id: string;
    workload_id: string;
    ingress_mode: string;
    delegation_token: string;
    action: {
        type: string;
        method: string;
        target_host: string;
        target_path: string;
        params: Record<string, unknown>;
    };
    attribution: Record<string, unknown>;
}

function buildActionRequest(cfg: AiGatewayConfig, delegationToken: string, params: Record<string, unknown>): ActionBody {
    return {
        schema: "mvgc.action_request.v2",
        org_id: "",
        workload_id: cfg.workload_id,
        ingress_mode: "explicit_action_request",
        delegation_token: delegationToken,
        action: {
            type: "llm_chat",
            method: "POST",
            target_host: "api.openai.com",
            target_path: "/v1/chat/completions",
            params,
        },
        attribution: {
            project_id: cfg.project_id,
            account_id: cfg.account_id,
            customer_id: cfg.customer_id,
            labels: { source: "delegation-example" },
        },
    };
}

async function postAction(cfg: AiGatewayConfig, payload: ActionBody): Promise<{ status: number; body: Record<string, unknown> }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.gateway_token) headers["Authorization"] = `Bearer ${cfg.gateway_token}`;

    const response = await fetch(`${cfg.gateway_url}/v1/actions:execute`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    });

    let body: Record<string, unknown>;
    try {
        body = await response.json() as Record<string, unknown>;
    } catch {
        body = { raw: await response.text().catch(() => "(unreadable)") };
    }
    return { status: response.status, body };
}

// ---------------------------------------------------------------------------
// Demos
// ---------------------------------------------------------------------------

function demoShowTokenStructure(tokenJson: string): void {
    console.log("\n--- Delegation token structure ---");
    const tok = JSON.parse(tokenJson) as DelegationToken;
    const { sig, ...display } = tok;
    console.log(JSON.stringify(display, null, 2));
    console.log(`  [sig.key_id=${sig.key_id}  algorithm=${sig.algorithm}]`);
}

async function demoDelegatedRequest(cfg: AiGatewayConfig, tokenJson: string): Promise<void> {
    console.log("\n--- Delegated request (llm_chat allowed) ---");
    const payload = buildActionRequest(cfg, tokenJson, {
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages: [{ role: "user", content: "Say 'hello from delegation' in one sentence." }],
    });
    const { status, body } = await postAction(cfg, payload);
    console.log(`HTTP ${status}  decision=${body["decision"] ?? "?"}`);
    const result = body["result"] as Record<string, unknown> | undefined;
    if (result) {
        const resultBody = result["body"] as Record<string, unknown> | undefined;
        const choices = resultBody?.["choices"] as Array<{ message?: { content?: string } }> | undefined;
        if (choices?.[0]?.message?.content) {
            console.log(`Response: ${choices[0].message.content}`);
        }
    } else if (body["reason"]) {
        console.log(`Reason: ${body["reason"]}`);
    }
}

async function demoScopeEnforcement(
    cfg: AiGatewayConfig,
    privateKey: crypto.KeyObject,
    publicKey: crypto.KeyObject,
): Promise<void> {
    console.log("\n--- Scope enforcement: llm_chat blocked (only ai.embed allowed) ---");
    const embedOnlyToken = createDelegationToken(privateKey, publicKey, {
        workload_id: cfg.workload_id,
        issued_by: "governance-service",
        audience: cfg.workload_id,
        ttl_seconds: 300,
        actions_allow: ["ai.embed"],   // does NOT include llm_chat
        targets_allow: ["api.openai.com"],
    });
    const payload = buildActionRequest(cfg, embedOnlyToken, {
        model: "gpt-4o-mini",
        max_tokens: 64,
        messages: [{ role: "user", content: "hello" }],
    });
    const { status, body } = await postAction(cfg, payload);
    console.log(`HTTP ${status}  decision=${body["decision"] ?? "?"}`);
    console.log(`Reason: ${body["reason"] ?? "—"}`);
}

async function demoBudgetConstrainedToken(
    cfg: AiGatewayConfig,
    privateKey: crypto.KeyObject,
    publicKey: crypto.KeyObject,
): Promise<void> {
    console.log("\n--- Budget-constrained delegation token ($0.001 cap) ---");
    const microBudgetToken = createDelegationToken(privateKey, publicKey, {
        workload_id: cfg.workload_id,
        issued_by: "governance-service",
        audience: cfg.workload_id,
        ttl_seconds: 300,
        actions_allow: ["llm_chat"],
        usd_max: "0.001",
        max_requests: 1,
    });
    const tok = JSON.parse(microBudgetToken) as DelegationToken;
    console.log(`Token budget: usd_max=${tok.budget.usd_max ?? "—"}  max_requests=${tok.budget.max_requests ?? "—"}`);

    const payload = buildActionRequest(cfg, microBudgetToken, {
        model: "gpt-4o-mini",
        max_tokens: 512,
        messages: [{ role: "user", content: "Write a 400-word essay about governance." }],
    });
    const { status, body } = await postAction(cfg, payload);
    console.log(`HTTP ${status}  decision=${body["decision"] ?? "?"}`);
    if (body["reason"]) {
        console.log(`Reason: ${body["reason"]}`);
    } else if (body["result"]) {
        console.log("Request succeeded (budget not yet exceeded at token level)");
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
        cause.includes("econnrefused")
    );
}

async function main(): Promise<void> {
    dotenv.config();

    const cfg = new AiGatewayConfig();
    console.log(`Gateway: ${cfg.gateway_url}`);
    console.log(`Workload: ${cfg.workload_id}  Project: ${cfg.project_id}`);
    console.log();
    console.log("NOTE: This example uses an ephemeral Ed25519 key pair.");
    console.log("      A real gateway will reject tokens unless its MVGC_DELEGATION_VERIFY_KEY");
    console.log("      matches the public key used here.  The demos below show the wire format");
    console.log("      and scope enforcement logic independent of gateway key config.");

    // Generate an ephemeral Ed25519 signing key.
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");

    const tokenJson = createDelegationToken(privateKey, publicKey, {
        workload_id: cfg.workload_id,
        issued_by: "governance-service",
        audience: cfg.workload_id,
        ttl_seconds: 3600,
        actions_allow: ["llm_chat", "ai.embed"],
        targets_allow: ["api.openai.com", "api.anthropic.com"],
        usd_max: "5.00",
    });

    try {
        demoShowTokenStructure(tokenJson);
        await demoDelegatedRequest(cfg, tokenJson);
        await demoScopeEnforcement(cfg, privateKey, publicKey);
        await demoBudgetConstrainedToken(cfg, privateKey, publicKey);
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
