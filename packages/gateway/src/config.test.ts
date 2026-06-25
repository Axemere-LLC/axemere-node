import { AiGatewayConfig } from "./config";

describe("AiGatewayConfig", () => {
    it("reads gateway_url from env", () => {
        process.env["AXEMERE_GATEWAY_URL"] = "http://localhost:7080";
        const cfg = new AiGatewayConfig();
        expect(cfg.gateway_url).toBe("http://localhost:7080");
        delete process.env["AXEMERE_GATEWAY_URL"];
    });

    it("constructor arg takes precedence over env", () => {
        process.env["AXEMERE_GATEWAY_URL"] = "http://from-env";
        const cfg = new AiGatewayConfig({ gateway_url: "http://explicit" });
        expect(cfg.gateway_url).toBe("http://explicit");
        delete process.env["AXEMERE_GATEWAY_URL"];
    });

    it("proxyUrl with no token", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "http://localhost:7080",
            gateway_token: "",
            workload_id: "wl_test",
            project_id: "",
            account_id: "",
            customer_id: "",
        });
        expect(cfg.proxyUrl("openai")).toBe("http://localhost:7080/proxy/openai/w/wl_test/");
    });

    it("proxyUrl with token", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "https://gw.axemere.ai",
            gateway_token: "axm_k_abc",
            workload_id: "wl_x",
            project_id: "",
            account_id: "",
            customer_id: "",
        });
        expect(cfg.proxyUrl("anthropic")).toBe(
            "https://gw.axemere.ai/proxy/anthropic/k/axm_k_abc/w/wl_x/",
        );
    });

    it("proxyUrl with all attribution segments", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "https://gw.axemere.ai",
            gateway_token: "tok",
            workload_id: "wl_1",
            project_id: "proj_1",
            account_id: "acc_1",
            customer_id: "cust_1",
        });
        expect(cfg.proxyUrl("openai")).toBe(
            "https://gw.axemere.ai/proxy/openai/k/tok/w/wl_1/p/proj_1/a/acc_1/c/cust_1/",
        );
    });

    it("proxyUrl with no segments appends trailing slash", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "http://localhost:7080",
            gateway_token: "",
            project_id: "",
            account_id: "",
            customer_id: "",
        });
        expect(cfg.proxyUrl("openai")).toBe("http://localhost:7080/proxy/openai/");
    });

    it("parses AXEMERE_LABELS from JSON", () => {
        process.env["AXEMERE_LABELS"] = '{"env":"prod","team":"ml"}';
        const cfg = new AiGatewayConfig();
        expect(cfg.labels).toEqual({ env: "prod", team: "ml" });
        delete process.env["AXEMERE_LABELS"];
    });

    it("uses empty labels when AXEMERE_LABELS is invalid JSON", () => {
        process.env["AXEMERE_LABELS"] = "not-json";
        const cfg = new AiGatewayConfig();
        expect(cfg.labels).toEqual({});
        delete process.env["AXEMERE_LABELS"];
    });

    it("defaults timeout to 120", () => {
        const cfg = new AiGatewayConfig({});
        expect(cfg.timeout).toBe(120);
    });

    it("reads AXEMERE_TIMEOUT_SECONDS from env", () => {
        process.env["AXEMERE_TIMEOUT_SECONDS"] = "30";
        const cfg = new AiGatewayConfig();
        expect(cfg.timeout).toBe(30);
        delete process.env["AXEMERE_TIMEOUT_SECONDS"];
    });

    it("setDefaults updates provider and model", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        cfg.setDefaults({ provider: "openai", model: "gpt-4o" });
        expect(cfg.default_provider).toBe("openai");
        expect(cfg.default_model).toBe("gpt-4o");
    });

    it("reads gateway_token from env", () => {
        process.env["AXEMERE_GATEWAY_TOKEN"] = "tok_from_env";
        const cfg = new AiGatewayConfig();
        expect(cfg.gateway_token).toBe("tok_from_env");
        delete process.env["AXEMERE_GATEWAY_TOKEN"];
    });

    it("coerces non-string label values in AXEMERE_LABELS to strings", () => {
        process.env["AXEMERE_LABELS"] = '{"count":42,"flag":true}';
        const cfg = new AiGatewayConfig();
        expect(cfg.labels["count"]).toBe("42");
        expect(cfg.labels["flag"]).toBe("true");
        delete process.env["AXEMERE_LABELS"];
    });
});
