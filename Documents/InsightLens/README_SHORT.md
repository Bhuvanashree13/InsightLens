# InsightLens (Short README)

## Architecture and Tools Used
- **Frontend:** React + Vite (`insightlens_frontend`) for Login, Signup, and Dashboard UI.
- **Backend:** Node.js + Express (`insightLens_backend`) exposing:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/sentiment/analyze`
- **Data Layer:** MongoDB + Mongoose models (`User`, `Analysis`) when available.
- **Auth:** JWT-based authentication with protected sentiment route.
- **AI Layer:** OpenAI Responses API (`gpt-4o-mini` default) via `services/openaiService.js`.
- **Resilience:** In-memory fallback logic for auth/analysis when external services are temporarily unavailable.

## Prompt and AI Logic
- The backend builds a structured analysis prompt with:
  - brand name
  - cleaned social posts (one per line)
  - strict JSON output format (`overall_sentiment`, `themes`, `recommendations`, `sentiment_breakdown`)
- Input is normalized and constrained (post count/length/total size) before calling the model.
- A hash-based cache avoids repeated calls for the same brand+posts payload.
- Retry/backoff is applied for transient API failures (`429`, `503`).
- If OpenAI remains rate-limited, a local heuristic fallback generates the same JSON shape so the UI can still render results.

## Improvements With More Time
- Add robust observability: request IDs, structured logs, and metrics for retries/fallback usage.
- Improve prompt quality with few-shot examples and stricter JSON enforcement via schema validation.
- Add test coverage (unit + integration) for auth, sentiment parsing, retry paths, and failure modes.
- Add rate limiting and abuse protection at API level, plus better secret management and key rotation.
- Will be able to  deploy this sentiment analysis of brand posts.