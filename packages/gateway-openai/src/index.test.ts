import OpenAI from "openai";
import { AiGatewayConfig } from "@axemere/gateway";
import { openaiClient } from "./index";

describe("openaiClient()", () => {
    it("returns an OpenAI instance", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = openaiClient(cfg);
        expect(client).toBeInstanceOf(OpenAI);
    });

    it("uses proxyUrl(openai) + v1/ as baseURL", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "http://localhost:7080",
            gateway_token: "tok_test",
            project_id: "",
            account_id: "",
            customer_id: "",
        });
        const client = openaiClient(cfg);
        // OpenAI stores the resolved baseURL on the instance
        expect((client as unknown as { baseURL: string }).baseURL).toBe(
            "http://localhost:7080/proxy/openai/k/tok_test/v1/",
        );
    });

    it("falls back to sentinel apiKey when gateway_token is empty", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080", gateway_token: "" });
        const client = openaiClient(cfg);
        expect((client as unknown as { apiKey: string }).apiKey).toBe("axemere-gateway");
    });

    it("uses gateway_token as apiKey when set", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "http://localhost:7080",
            gateway_token: "my_token",
        });
        const client = openaiClient(cfg);
        expect((client as unknown as { apiKey: string }).apiKey).toBe("my_token");
    });

    it("constructs with default config when no config passed", () => {
        delete process.env["AXEMERE_GATEWAY_URL"];
        delete process.env["AXEMERE_GATEWAY_TOKEN"];
        expect(() => openaiClient()).not.toThrow();
    });

    it("merges extra options after gateway defaults", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = openaiClient(cfg, { maxRetries: 0, timeout: 5000 });
        expect((client as unknown as { maxRetries: number }).maxRetries).toBe(0);
    });
});
