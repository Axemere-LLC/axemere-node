import { GoogleGenerativeAI } from "@google/generative-ai";
import { AiGatewayConfig } from "@axemere/gateway";
import { genaiClient } from "./index";

describe("genaiClient()", () => {
    it("returns a GoogleGenerativeAI instance", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = genaiClient(cfg);
        expect(client).toBeInstanceOf(GoogleGenerativeAI);
    });

    it("constructs with default config when no config passed", () => {
        delete process.env["AXEMERE_GATEWAY_URL"];
        delete process.env["AXEMERE_GATEWAY_TOKEN"];
        expect(() => genaiClient()).not.toThrow();
    });

    it("injects Authorization header from gateway_token", () => {
        const cfg = new AiGatewayConfig({
            gateway_url: "http://localhost:7080",
            gateway_token: "tok_test",
        });
        const client = genaiClient(cfg);
        // Retrieve the options injected into getGenerativeModel by calling it and
        // inspecting the GenerativeModel's private _requestOptions.
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        const opts = (model as unknown as { _requestOptions: { customHeaders: Headers } })
            ._requestOptions;
        expect(opts.customHeaders.get("Authorization")).toBe("Bearer tok_test");
    });

    it("sets baseUrl to the gateway URL", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = genaiClient(cfg);
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        const opts = (model as unknown as { _requestOptions: { baseUrl: string } })
            ._requestOptions;
        expect(opts.baseUrl).toBe("http://localhost:7080");
    });

    it("sets X-MVGC-Target-Host to generativelanguage.googleapis.com", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = genaiClient(cfg);
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        const opts = (model as unknown as { _requestOptions: { customHeaders: Headers } })
            ._requestOptions;
        expect(opts.customHeaders.get("X-MVGC-Target-Host")).toBe(
            "generativelanguage.googleapis.com",
        );
    });

    it("caller requestOptions override gateway defaults", () => {
        const cfg = new AiGatewayConfig({ gateway_url: "http://localhost:7080" });
        const client = genaiClient(cfg);
        const model = client.getGenerativeModel(
            { model: "gemini-1.5-flash" },
            { baseUrl: "http://other-gateway:9090" },
        );
        const opts = (model as unknown as { _requestOptions: { baseUrl: string } })
            ._requestOptions;
        expect(opts.baseUrl).toBe("http://other-gateway:9090");
    });
});
