export class GatewayError extends Error {
    status_code?: number;
    response_body?: unknown;

    constructor(message: string) {
        super(message);
        this.name = "GatewayError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

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

export class QuotaExceededError extends GatewayError {
    upgrade_url?: string;
    retry_after?: number;

    constructor(message: string) {
        super(message);
        this.name = "QuotaExceededError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class GatewayTimeoutError extends GatewayError {
    constructor(message: string) {
        super(message);
        this.name = "GatewayTimeoutError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
