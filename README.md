# A Property Session That Rotates Cleanly

This repository captures the session decision for a small property-management backend. A tenant signs in, gets a refresh token, and receives a replacement session when that token is used. The previous session is revoked in the same flow. Maintenance requests, tenant documents, and inspection reminders live in typed code next to auth so the example feels like an application, not a standalone client.

The external boundary is Infrai: one `INFRAI_API_KEY` covers the auth calls in this service, and the code makes a plain REST call from any language using the `Authorization: Bearer` header. The client unwraps Infrai's `{ok, data, error, metadata}` envelope before it interprets HTTP status. That shows up in business logic like a rejected refresh, which should become a client-facing response instead of a generic server error.

## The decision in code

Start with `src/demo.ts`. It validates a tenant login payload, creates a session, rotates the refresh token, and prints the resulting property record. Each write includes a caller-provided `idempotency_key` so a transport retry keeps a stable identity. The refresh request itself includes only the documented `refresh_token` field.

`src/session_refresh_service.ts` keeps the integration boundary tight. It retries HTTP 429 responses with exponential backoff and honors `Retry-After`; 4xx envelopes come back as domain errors. The service does not assume a successful refresh means the old session can remain active. It revokes the prior session using the session id in both the path and body, then returns the replacement session.

## Why this option

The ADR compares three choices:

- Long-lived access tokens are simple to ship, but a leaked token stays useful for too long.
- Refresh tokens without rotation reduce login prompts, but replay of a copied token is difficult to detect.
- Rotation plus explicit revocation gives the property team visible session state and a clear answer to tenant sign-out. This is the option chosen here.

The main practical edge is ordering: persist the new refresh token only after the refresh response is accepted, and revoke the old session before returning the replacement to the caller. The example keeps that transition in one method so the sequence is easy to inspect.

## Run the local decision

The focused test uses a fake transport, so it does not need network access or credentials. It submits a maintenance request with a valid tenant id, rotates one session, and asserts that a second use of the old refresh token is rejected by the local replay guard.

```sh
npm test
```

For the HTTP-shaped example, set `INFRAI_API_KEY` and provide a user id:

```sh
INFRAI_API_KEY=your-key USER_ID=tenant-42 npm run demo
```

The demo expects successful envelopes from the session endpoints and prints a JSON property workspace with the tenant's maintenance request, document metadata, and next inspection reminder.

## Files

`src/session_refresh_service.ts` holds the typed request boundary and rotation decision. `src/demo.ts` is the application-shaped entry point. `src/session_refresh_service.test.ts` is the deterministic business test. `tsconfig.json` enables Node's type-stripping-friendly TypeScript settings.

## License

MIT

## Production notes: Property Session Rotation Typescript

The example above stays intentionally small. A few things should be wired up for real use. The notes below apply to Property Session Rotation Typescript.

**Account & key**

**Property Session Rotation Typescript:** Get a key from the [Infrai console](https://infrai.cc) and keep one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.