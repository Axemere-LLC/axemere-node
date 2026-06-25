/**
 * Base error for all gateway failures (config, network, and non-OK HTTP
 * responses from the gateway or upstream provider). More specific subclasses
 * are thrown for policy denials, quota limits, and timeouts.
 *
 * @property status_code - HTTP status of the failing response, when available.
 * @property response_body - Parsed response body, when available.
 */
export class GatewayError extends Error {
    status_code?: number;
    response_body?: unknown;

    constructor(message: string) {
        super(message);
        this.name = "GatewayError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when the gateway denies a request by policy.
 *
 * @property reason - Human-readable denial reason from the gateway.
 * @property trace - Optional policy-evaluation trace explaining the decision.
 * @property record_id - Audit ledger record id for the denied request, if any.
 */
export class PolicyDeniedError extends GatewayError {
    reason: string;
    trace?: unknown;
    record_id?: string;

    constructor(message: string) {
        super(message);
        this.name = "PolicyDeniedError";
        this.reason = "";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when a spend or quota limit is exceeded (HTTP 429).
 *
 * @property upgrade_url - URL to raise the limit / upgrade the plan, if provided.
 * @property retry_after - Seconds to wait before retrying, if provided.
 */
export class QuotaExceededError extends GatewayError {
    upgrade_url?: string;
    retry_after?: number;

    constructor(message: string) {
        super(message);
        this.name = "QuotaExceededError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when a request times out — either the client-side AbortController
 * deadline (`AXEMERE_TIMEOUT_SECONDS`) or an HTTP 504 from the gateway.
 */
export class GatewayTimeoutError extends GatewayError {
    constructor(message: string) {
        super(message);
        this.name = "GatewayTimeoutError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
