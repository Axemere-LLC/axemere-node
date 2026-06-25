import Anthropic from "@anthropic-ai/sdk";
import { AiGatewayConfig } from "@axemere/gateway";
import { anthropicClient } from "./index";

describe("anthropicClient()", () => {
    it("returns an Anthropic instance", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = anthropicClient(cfg);
        expect(client).toBeInstanceOf(Anthropic);
    });

    it("uses proxyUrl(anthropic) as baseURL", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "http://localhost:7080",
            gateway_token: "tok_test",
            project_id: "",
            account_id: "",
            customer_id: "",
        });
        const client = anthropicClient(cfg);
        expect((client as unknown as { baseURL: string }).baseURL).toBe(
            "http://localhost:7080/proxy/anthropic/k/tok_test/",
        );
    });

    it("falls back to sentinel apiKey when gateway_token is empty", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080", gateway_token: "" });
        const client = anthropicClient(cfg);
        expect((client as unknown as { apiKey: string }).apiKey).toBe("axemere-gateway");
    });

    it("uses gateway_token as apiKey when set", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "http://localhost:7080",
            gateway_token: "my_token",
        });
        const client = anthropicClient(cfg);
        expect((client as unknown as { apiKey: string }).apiKey).toBe("my_token");
    });

    it("constructs with default config when no config passed", () => {
        delete process.env["AXEMERE_GATEWAY_URL"];
        delete process.env["AXEMERE_GATEWAY_TOKEN"];
        expect(() => anthropicClient()).not.toThrow();
    });

    it("merges extra options after gateway defaults", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = anthropicClient(cfg, { maxRetries: 0 });
        expect((client as unknown as { maxRetries: number }).maxRetries).toBe(0);
    });
});
