export interface ProviderRoute {
    host: string;
    path: string;
}

export const PROVIDER_ROUTES: Record<string, ProviderRoute> = {
    openai:      { host: "api.openai.com",                    path: "/v1/chat/completions" },
    anthropic:   { host: "api.anthropic.com",                 path: "/v1/messages" },
    google:      { host: "generativelanguage.googleapis.com", path: "/v1beta/models/{model}:generateContent" },
    cohere:      { host: "api.cohere.com",                    path: "/v2/chat" },
    mistral:     { host: "api.mistral.ai",                    path: "/v1/chat/completions" },
    groq:        { host: "api.groq.com",                      path: "/openai/v1/chat/completions" },
    deepseek:    { host: "api.deepseek.com",                  path: "/v1/chat/completions" },
    together:    { host: "api.together.ai",                   path: "/v1/chat/completions" },
    minimax:     { host: "api.minimax.chat",                  path: "/v1/text/chatcompletion_v2" },
    moonshot:    { host: "api.moonshot.ai",                   path: "/v1/chat/completions" },
    zhipu:       { host: "api.z.ai",                          path: "/api/paas/v4/chat/completions" },
    xai:         { host: "api.x.ai",                          path: "/v1/chat/completions" },
    perplexity:  { host: "api.perplexity.ai",                 path: "/chat/completions" },
    openrouter:  { host: "openrouter.ai",                     path: "/api/v1/chat/completions" },
    nvidia_nim:  { host: "integrate.api.nvidia.com",          path: "/v1/chat/completions" },
    upstage:     { host: "api.upstage.ai",                    path: "/v1/chat/completions" },
    fireworks:   { host: "api.fireworks.ai",                  path: "/inference/v1/chat/completions" },
};
