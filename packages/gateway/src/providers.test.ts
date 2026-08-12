import { PROVIDER_ROUTES } from "./providers";

// provider -> [host, path, format]
// Host/path values must match the MVGC gateway's provider registry
// (internal/types/provider_registry.go Hosts[0]) and openai_compat profiles
// exactly, or requests either get denied by auto-policy (wrong host) or 404
// upstream (wrong path).
const EXPECTED_ROUTES: Record<string, [string, string, string]> = {
    openai:       ["api.openai.com", "/v1/chat/completions", "openai"],
    anthropic:    ["api.anthropic.com", "/v1/messages", "anthropic"],
    gemini:       ["generativelanguage.googleapis.com", "/v1beta/models/{model}:generateContent", "gemini"],
    google:       ["generativelanguage.googleapis.com", "/v1beta/models/{model}:generateContent", "gemini"],
    cohere:       ["api.cohere.com", "/v2/chat", "openai"],
    mistral:      ["api.mistral.ai", "/v1/chat/completions", "openai"],
    groq:         ["api.groq.com", "/openai/v1/chat/completions", "openai"],
    deepseek:     ["api.deepseek.com", "/v1/chat/completions", "openai"],
    together:     ["api.together.ai", "/v1/chat/completions", "openai"],
    minimax:      ["api.minimax.io", "/v1/chat/completions", "openai"],
    moonshot:     ["api.moonshot.ai", "/v1/chat/completions", "openai"],
    zhipu:        ["api.z.ai", "/api/paas/v4/chat/completions", "openai"],
    xai:          ["api.x.ai", "/v1/chat/completions", "openai"],
    perplexity:   ["api.perplexity.ai", "/chat/completions", "openai"],
    openrouter:   ["openrouter.ai", "/api/v1/chat/completions", "openai"],
    "nvidia-nim": ["integrate.api.nvidia.com", "/v1/chat/completions", "openai"],
    upstage:      ["api.upstage.ai", "/v1/chat/completions", "openai"],
    fireworks:    ["api.fireworks.ai", "/inference/v1/chat/completions", "openai"],
    qwen:         ["dashscope-intl.aliyuncs.com", "/v1/chat/completions", "openai"],
    bytedance:    ["ark.cn-beijing.volces.com", "/api/v3/chat/completions", "openai"],
    stepfun:      ["api.stepfun.com", "/v1/chat/completions", "openai"],
    bedrock:      ["bedrock-runtime.us-east-1.amazonaws.com", "", "openai"],
    vertex:       ["us-central1-aiplatform.googleapis.com", "", "openai"],
    azure_openai: ["", "/v1/chat/completions", "openai"],
};

describe("PROVIDER_ROUTES", () => {
    it("covers the full MVGC provider registry with correct host/path/format", () => {
        expect(Object.keys(PROVIDER_ROUTES).sort()).toEqual(Object.keys(EXPECTED_ROUTES).sort());

        for (const [provider, [host, path, format]] of Object.entries(EXPECTED_ROUTES)) {
            const route = PROVIDER_ROUTES[provider];
            expect(route).toBeDefined();
            expect(route.host).toBe(host);
            expect(route.path).toBe(path);
            expect(route.format).toBe(format);
        }
    });

    it("aliases google to the gemini route", () => {
        expect(PROVIDER_ROUTES["google"]).toEqual(PROVIDER_ROUTES["gemini"]);
    });
});
