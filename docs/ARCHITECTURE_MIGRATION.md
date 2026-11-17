# AI architecture analysis and Dify migration

## Existing implementation audit

The project contained no live LLM integration. There were no OpenAI, Anthropic, Gemini, Ollama, LangChain, agent, embedding, vector database, prompt-management, streaming, memory, or tool-calling dependencies. `OPENAI_API_KEY` and `OPENAI_MODEL` existed only as unused sample environment variables.

The only analysis producer was the synchronous `createDemoAnalysis(payload)` function in `server.js`. It combined a hard-coded service catalog with form input to produce the report JSON. The frontend rendered that JSON, MongoDB or an in-memory map stored it, and the Python PDF generator consumed it.

## Dependency map

```text
public/index.html + public/app.js
  -> GET /api/services
  -> POST /api/consultations
       -> request validation
       -> consultation rate limiter
       -> lib/dify-client.js
            -> Dify POST /v1/chat-messages for supplied Chatflow
            -> published Chatflow App
                 -> input validation/extraction
                 -> Knowledge Retrieval
                 -> LLM structured output
                 -> policy/output validation
            <- workflow outputs.analysis
       -> lib/analysis-schema.js
       -> MongoDB or development memory store
  <- unchanged analysis JSON contract
  -> in-page consultation report
  -> GET /api/consultations/:reference/pdf
       -> scripts/generate_consultation_pdf.py
```

## Migration decisions

- The supplied Dify application is a Chatflow, so the adapter uses `/v1/chat-messages` in `chatflow` mode. Workflow App mode remains supported through `/v1/workflows/run`.
- The browser-to-server API contract is unchanged.
- The Dify key is server-only and sent using `Authorization: Bearer`.
- Blocking workflow execution preserves the existing synchronous user experience. The adapter can later add SSE without changing the Dify workflow.
- The response is schema-validated before storage or rendering.
- Retry is limited to timeout, rate-limit, and transient server statuses.
- A deterministic fallback preserves the existing demo when explicitly enabled; production Compose disables it by default.
- Dify workflow run IDs, latency, and token usage are stored as operational metadata.
- Raw client email is not used as the Dify end-user identifier; a one-way truncated SHA-256 identifier is sent.

## Feature compatibility

| Capability | Before | After |
|---|---|---|
| Consultation analysis | Deterministic local rules | Dify Chatflow, explicit fallback available |
| RAG | Claimed in UI, not implemented | Dify Knowledge Retrieval configured in workflow |
| Prompt management | None | Versioned in Dify workflow |
| Provider choice | None | Managed by Dify |
| Streaming | Not implemented | Not added because existing UX is synchronous |
| Conversation memory | Not implemented | Not applicable to workflow app |
| Tool calling | Not implemented | Available inside Dify if later required |
| Report/PDF | Existing JSON contract | Unchanged |
| Persistence | MongoDB or memory | Unchanged, with Dify metadata added |

## Deployment boundary

The application is containerized separately from Dify. Dify Cloud or an official self-hosted Dify deployment supplies the `/v1` Service API. For self-hosting, use a pinned official Dify release and its maintained Compose configuration, persistent database/Redis/vector/storage volumes, HTTPS, backups, and observability. The application does not fork or vendor Dify infrastructure.

## Remaining external verification

A real Dify workflow run requires a published Workflow App URL and API key. Local automated tests validate authentication headers, request shape, retries, output normalization, fallback behavior, report persistence, and PDF generation. Provider/model quality, knowledge retrieval relevance, and the published Dify workflow cannot be verified without those external credentials and configured knowledge documents.
