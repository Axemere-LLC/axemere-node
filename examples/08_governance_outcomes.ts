/**
 * Example 08: Governance Outcomes Beyond Allow/Deny
 *
 * Demonstrates:
 * - HTTP 403 deny: standard policy denial (missing project_id)
 * - decision_trace on a successful allow response
 * - HTTP 202 require_approval: request held for human review; poll for decision
 * - HTTP 429 rate_limit: budget or rate cap exceeded; Retry-After header
 * - HTTP 403 quarantine: workload flagged; blocked with decision=quarantine
 *
 * These outcomes are triggered by policy rules in the active bundle. The demos send
 * requests whose attributes are crafted to match specific rule conditions as set up
 * in the mock gateway used for CI. Against a real gateway, configure the policy
 * bundle to produce each outcome.
 *
 * Set MVGC_ADMIN_TOKEN to enable auto-approve and poll the approval decision.
 *
 * Run:
 *   pnpm run:08
 *   # or: npx ts-node 08_governance_outcomes.ts
 */

import dotenv from "dotenv";
import { AiGatewayConfig } from "@axemere/gateway";

const ADMIN_TOKEN_ENV = "MVGC_ADMIN_TOKEN";

// ---------------------------------------------------------------------------
// Low-level request helper
// ---------------------------------------------------------------------------

interface ActionPayload {
    schema: string;
    org_id: string;
    workload_id: string;
    ingress_mode: string;
    action: {
        type: string;
        method: string;
        target_host: string;
        target_path: string;
        params: Record<string, unknown>;
    };
    attribution: Record<string, unknown>;
}

async function postAction(
    cfg: AiGatewayConfig,
    extraFields?: Partial<ActionPayload>,
): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }> {
    const payload: ActionPayload = {
        schema: "mvgc.action_request.v2",
        org_id: "",
        workload_id: cfg.workload_id,
        ingress_mode: "explicit_action_request",
        action: {
            type: "ai.infer",
            method: "POST",
            target_host: "api.openai.com",
            target_path: "/v1/chat/completions",
            params: {
                model: "gpt-4o-mini",
                max_tokens: 64,
                messages: [{ role: "user", content: "Hello." }],
            },
        },
        attribution: {
            project_id: cfg.project_id,
            customer_id: cfg.customer_id,
            account_id: cfg.account_id,
            labels: { source: "governance-outcomes-example" },
        },
        ...extraFields,
    };

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
    return { status: response.status, body, headers: response.headers };
}

// ---------------------------------------------------------------------------
// Approval polling
// ---------------------------------------------------------------------------

async function pollApproval(
    cfg: AiGatewayConfig,
    approvalId: string,
    adminToken: string,
    maxPolls = 6,
): Promise<Record<string, unknown>> {
    for (let attempt = 1; attempt <= maxPolls; attempt++) {
        const response = await fetch(
            `${cfg.gateway_url}/v1/admin/approvals/${approvalId}`,
            { headers: { Authorization: `Bearer ${adminToken}` } },
        );
        if (response.status !== 200) {
            const text = await response.text().catch(() => "");
            console.log(`  Poll ${attempt}: HTTP ${response.status} — ${text.slice(0, 100)}`);
            break;
        }
        const data = await response.json() as Record<string, unknown>;
        const status = String(data["status"] ?? "unknown");
        console.log(`  Poll ${attempt}: status=${status}`);
        if (status === "approved" || status === "denied") {
            return data;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return {};
}

// ---------------------------------------------------------------------------
// Demos
// ---------------------------------------------------------------------------

async function demoPolicyDeny(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- HTTP 403 deny: missing project_id ---");
    const noProjCfg = new AiGatewayConfig({
        gateway_url: cfg.gateway_url,
        gateway_token: cfg.gateway_token,
        workload_id: cfg.workload_id,
        project_id: "",
        customer_id: cfg.customer_id,
        account_id: cfg.account_id,
    });
    const { status, body } = await postAction(noProjCfg);
    console.log(`HTTP ${status}  decision=${body["decision"] ?? "?"}`);
    console.log(`Reason: ${body["reason"] ?? body["error"] ?? "—"}`);
    const trace = body["decision_trace"] as Record<string, unknown> | undefined;
    if (trace?.["reason_codes"]) {
        console.log(`Reason codes: ${JSON.stringify(trace["reason_codes"])}`);
    }
}

async function demoDecisionTrace(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- decision_trace on a successful allow ---");
    const { status, body } = await postAction(cfg);
    console.log(`HTTP ${status}  decision=${body["decision"] ?? "?"}`);
    const trace = body["decision_trace"] as Record<string, unknown> | undefined;
    if (trace) {
        console.log(`Schema:       ${trace["schema"] ?? "—"}`);
        console.log(`Decision:     ${trace["decision"] ?? "—"}`);
        console.log(`Reason codes: ${JSON.stringify(trace["reason_codes"] ?? [])}`);
        console.log(`Evaluated at: ${trace["evaluated_at"] ?? "—"}`);
        const attrs = trace["attributes"] as Record<string, unknown> | undefined;
        if (attrs) {
            for (const [k, v] of Object.entries(attrs).slice(0, 4)) {
                console.log(`  ${k}: ${v}`);
            }
        }
    } else {
        console.log("No decision_trace in response.");
    }
}

async function demoRequireApproval(cfg: AiGatewayConfig, adminToken: string): Promise<void> {
    console.log("\n--- HTTP 202 require_approval ---");
    // Use a label that triggers a require_approval rule in the mock gateway.
    const { status, body } = await postAction(cfg, {
        attribution: {
            project_id: cfg.project_id,
            customer_id: cfg.customer_id,
            account_id: cfg.account_id,
            labels: { risk_level: "high" },  // triggers require_approval in mock policy
        },
    });
    console.log(`HTTP ${status}  decision=${body["decision"] ?? "?"}`);

    if (status === 202) {
        const approvalId = String(body["approval_id"] ?? "");
        const recordId = String(body["record_id"] ?? "");
        console.log(`approval_id: ${approvalId}`);
        console.log(`record_id:   ${recordId}`);

        if (adminToken && approvalId) {
            console.log("\nAuto-approving via admin API (simulating human review)…");
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`,
            };
            const approveResp = await fetch(
                `${cfg.gateway_url}/v1/admin/approvals/${approvalId}/approve`,
                { method: "POST", headers, body: JSON.stringify({ decided_by: "example-script" }) },
            );
            console.log(`Approve response: HTTP ${approveResp.status}`);

            console.log("Polling for final status…");
            const result = await pollApproval(cfg, approvalId, adminToken);
            if (Object.keys(result).length > 0) {
                console.log(`Final status: ${result["status"]}  decided_by=${result["decided_by"]}`);
            }
        } else {
            console.log(`(set ${ADMIN_TOKEN_ENV} to auto-approve and poll the decision)`);
        }
    } else if (status === 403) {
        console.log("Gateway returned 403 — MVGC_APPROVAL_ENABLED may be false (legacy mode)");
        console.log(`Reason: ${body["reason"] ?? "—"}`);
    } else {
        console.log(`Unexpected status; body: ${JSON.stringify(body).slice(0, 200)}`);
    }
}

async function demoRateLimit(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- HTTP 429 rate_limit: rapid-fire requests ---");
    for (let i = 1; i <= 50; i++) {
        const { status, body, headers } = await postAction(cfg);
        if (status === 429) {
            const retryAfter = headers.get("retry-after") ?? "?";
            console.log(`  Request ${i}: HTTP 429  Retry-After: ${retryAfter}s`);
            console.log(`  decision=${body["decision"] ?? "?"}  reason=${body["reason"] ?? "—"}`);
            return;
        }
        if (i % 10 === 0) {
            console.log(`  Sent ${i} requests — no 429 yet (decision=${body["decision"] ?? "?"})`);
        }
    }
    console.log("  Sent 50 requests without receiving a 429.");
    console.log("  Check that your gateway policy has a rate_limit rule for this workload.");
}

async function demoQuarantine(cfg: AiGatewayConfig): Promise<void> {
    console.log("\n--- HTTP 403 quarantine ---");
    // Use a label combination that triggers the quarantine rule in mock policy.
    const { status, body } = await postAction(cfg, {
        attribution: {
            project_id: cfg.project_id,
            customer_id: cfg.customer_id,
            account_id: cfg.account_id,
            labels: { source: "governance-outcomes-example", quarantine_trigger: "true" },
        },
    });
    console.log(`HTTP ${status}  decision=${body["decision"] ?? "?"}`);
    if (body["decision"] === "quarantine") {
        console.log(`record_id: ${body["record_id"] ?? "—"}`);
        console.log("The record is stored in the quarantine table.");
        console.log("Admin can review via: GET /v1/admin/quarantine");
        console.log("Admin can release via: POST /v1/admin/quarantine/{id}/release");
    } else if (status === 403) {
        console.log(`Reason: ${body["reason"] ?? body["error"] ?? "—"}`);
        console.log("(configure a quarantine rule in your policy bundle to see 'quarantine' decision)");
    } else {
        console.log(`Unexpected status; body: ${JSON.stringify(body).slice(0, 200)}`);
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
    const adminToken = process.env[ADMIN_TOKEN_ENV] ?? "";
    console.log(`Gateway:      ${cfg.gateway_url}`);
    console.log(`Workload:     ${cfg.workload_id}  Project: ${cfg.project_id}`);
    console.log(`Admin token:  ${adminToken ? "set" : `not set (set ${ADMIN_TOKEN_ENV} to enable approval polling)`}`);

    try {
        await demoPolicyDeny(cfg);
        await demoDecisionTrace(cfg);
        await demoRequireApproval(cfg, adminToken);
        await demoRateLimit(cfg);
        await demoQuarantine(cfg);
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
