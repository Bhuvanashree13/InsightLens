# InsightLens Backend

This Express/MongoDB service powers the sentiment analysis API.

## Environment variables

The backend requires a `.env` file with the following entries:

```
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<secret for signing tokens>

# Choose which LLM provider to use:
LLM_PROVIDER=hf          # "hf" for HuggingFace (default), "grok" for OpenAI/Grok

# When using HuggingFace:
HUGGINGFACE_API_KEY=<your HF inference key>
HF_MODEL=<optional model name, e.g. google/flan-t5-large>

# When using Grok/OpenAI:
OPENAI_API_KEY=<your OpenAI API key>
GROK_MODEL=<optional model name, e.g. grok-1 or gpt-4o-mini>
```

You can also set `HF_DEBUG=1` to log LLM requests.

## Switching providers

- **Hugging Face** is used by default (`LLM_PROVIDER=hf`). It calls a model via the
  HuggingFace Inference API and supports retries/backoff and caching.
- **Grok/OpenAI** can be selected by setting `LLM_PROVIDER=grok`. The service will
  call the OpenAI Responses endpoint and accept any model that supports text
  generation (e.g. `grok-1`, `gpt-4o-mini`).

## Running the server

```bash
cd insightLens_backend
npm install
cp .env.example .env    # or copy from the README above
npm run dev
```

The frontend and authentication are unchanged; this README focuses on the LLM
configuration.