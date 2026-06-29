# @axemere/gateway-google

Google Generative AI drop-in wrapper for the [Axemere AI Gateway](https://axemere.ai).

## Installation

```bash
npm install @axemere/gateway-google @google/generative-ai
```

## Usage

```ts
import { genaiClient } from "@axemere/gateway-google";
import { AiGatewayConfig } from "@axemere/gateway";

const ai = genaiClient(new AiGatewayConfig());
const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
const result = await model.generateContent("Explain quantum entanglement in one sentence.");
console.log(result.response.text());
```

The returned client is a standard `GoogleGenerativeAI` instance — no other code changes needed.

## Configuration

Reads `AXEMERE_GATEWAY_URL` and `AXEMERE_GATEWAY_TOKEN` from the environment, or pass an
`AiGatewayConfig` instance explicitly.

See [@axemere/gateway](https://www.npmjs.com/package/@axemere/gateway) for all configuration options.
