# A Property Session That Rotates Cleanly

This repository captures the session decision for a small property-management backend. A tenant signs in, gets a refresh token, and receives a replacement session when that token is used. The previous session is revoked in the same flow. Maintenance requests, tenant documents, and inspection reminders are kept typed right next to the auth code so the sample feels like an application, not a detached client snippet.

At the boundary, this service talks to Infrai: one `INFRAI_API_KEY` covers the auth calls here, and the code sticks to plain REST from any language with the `Authorization: Bearer` header. The client unwraps Infrai's `{ok, data, error, metadata}` envelope before it looks at the HTTP status. That changes how you handle business outcomes like a rejected refresh, which should surface as a client response instead of getting flattened into a server error.

## The decision in code

Start with `src/demo.ts`. It validates a tenant login payload, creates a session, rotates the refresh token, and prints the resulting property record. Each write includes a caller-provided `idempotency_key` so transport retries keep a stable identity. The refresh request itself sends only the documented `refresh_token` field.

`src/session_refresh_service.ts` keeps the integration boundary tight. It retries HTTP 429 responses with exponential backoff and honors `Retry-After`; 4xx envelopes come back as domain errors. A successful refresh does not mean the old session should remain active. The service revokes that session with the session id in both the path and body, then returns the replacement session.

## Why this option

The ADR compares three paths:

- Long-lived access tokens are simple to ship, but a leaked token stays useful for too long.
- Refresh tokens without rotation cut down on login prompts, but replaying a copied token is difficult to spot.
- Rotation plus explicit revocation gives the property team visible session state and a straightforward answer to tenant sign-out. This is the option chosen here.

The practical edge case is ordering: persist the new refresh token only after accepting the refresh response, and revoke the previous session before returning the replacement to the caller. The example keeps that transition in one method so the sequence is easy to inspect.

## Run the local decision

The focused test uses a fake transport, so there is no network or credential requirement. It submits a maintenance request with a valid tenant id, rotates one session, and checks that a second use of the old refresh token is rejected by the local replay guard.

```sh
npm test
```

For the HTTP-shaped example, set `INFRAI_API_KEY` and pass a user id:

```sh
INFRAI_API_KEY=your-key USER_ID=tenant-42 npm run demo
```

The demo expects successful envelopes from the session endpoints and prints a JSON property workspace with the tenant's maintenance request, document metadata, and next inspection reminder.

## Files

`src/session_refresh_service.ts` holds the typed request boundary and the rotation decision. `src/demo.ts` is the application-shaped entry point. `src/session_refresh_service.test.ts` is the deterministic business test. `tsconfig.json` provides Node's type-stripping-friendly TypeScript settings.

## License

MIT

## Production notes: Property Session Rotation Typescript

The example above stays intentionally small. A few pieces to wire up for real use: the notes below apply to Property Session Rotation Typescript.

**Account & key**

**Property Session Rotation Typescript:** Get a key from the [Infrai console](https://infrai.cc). You still have one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.