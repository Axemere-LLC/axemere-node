/**
 * Host, path, and body-shaping format for each provider the gateway routes to.
 *
 * Values must match the MVGC gateway's provider registry
 * (`internal/types/provider_registry.go` `Hosts[0]`) and `openai_compat`
 * profiles exactly — a wrong host is denied by auto-policy, a wrong path
 * 404s upstream.
 */
export interface ProviderRoute {
    host: string;
    path: string;
    format: "openai" | "anthropic" | "gemini";
}

export const PROVIDER_ROUTES: Record<string, ProviderRoute> = {
    openai:       { host: "api.openai.com",                           path: "/v1/chat/completions",                    format: "openai" },
    anthropic:    { host: "api.anthropic.com",                        path: "/v1/messages",                            format: "anthropic" },
    gemini:       { host: "generativelanguage.googleapis.com",        path: "/v1beta/models/{model}:generateContent",  format: "gemini" },
    google:       { host: "generativelanguage.googleapis.com",        path: "/v1beta/models/{model}:generateContent",  format: "gemini" },
    cohere:       { host: "api.cohere.com",                           path: "/v2/chat",                                format: "openai" },
    mistral:      { host: "api.mistral.ai",                           path: "/v1/chat/completions",                    format: "openai" },
    groq:         { host: "api.groq.com",                             path: "/openai/v1/chat/completions",             format: "openai" },
    deepseek:     { host: "api.deepseek.com",                         path: "/v1/chat/completions",                    format: "openai" },
    together:     { host: "api.together.ai",                          path: "/v1/chat/completions",                    format: "openai" },
    minimax:      { host: "api.minimax.io",                           path: "/v1/chat/completions",                    format: "openai" },
    moonshot:     { host: "api.moonshot.ai",                          path: "/v1/chat/completions",                    format: "openai" },
    zhipu:        { host: "api.z.ai",                                 path: "/api/paas/v4/chat/completions",           format: "openai" },
    xai:          { host: "api.x.ai",                                 path: "/v1/chat/completions",                    format: "openai" },
    perplexity:   { host: "api.perplexity.ai",                        path: "/chat/completions",                       format: "openai" },
    openrouter:   { host: "openrouter.ai",                            path: "/api/v1/chat/completions",                format: "openai" },
    "nvidia-nim": { host: "integrate.api.nvidia.com",                 path: "/v1/chat/completions",                    format: "openai" },
    upstage:      { host: "api.upstage.ai",                           path: "/v1/chat/completions",                    format: "openai" },
    fireworks:    { host: "api.fireworks.ai",                         path: "/inference/v1/chat/completions",          format: "openai" },
    qwen:         { host: "dashscope-intl.aliyuncs.com",              path: "/v1/chat/completions",                    format: "openai" },
    bytedance:    { host: "ark.cn-beijing.volces.com",                path: "/api/v3/chat/completions",                format: "openai" },
    stepfun:      { host: "api.stepfun.com",                          path: "/v1/chat/completions",                    format: "openai" },
    bedrock:      { host: "bedrock-runtime.us-east-1.amazonaws.com",  path: "",                                        format: "openai" },
    vertex:       { host: "us-central1-aiplatform.googleapis.com",    path: "",                                        format: "openai" },
    // azure_openai has no static host — the registry gives only HostSuffixes,
    // so callers must supply target_host explicitly.
    azure_openai: { host: "",                                         path: "/v1/chat/completions",                    format: "openai" },
};
