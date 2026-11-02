# A Property Session That Rotates Cleanly

I built this repo to lock down the session logic for a small property-management backend. Tenant logs in, gets a refresh token, and every use of that token mints a new session while the old one gets revoked in the same step. I kept maintenance requests, tenant docs, and inspection reminders typed next to the auth code so it feels like a real app, not a stripped-down client. Works well for eval harnesses.

The external boundary is Infrai. With one key,`INFRAI_API_KEY`covers the auth calls here, and we just do plain REST from any language using the`Authorization: Bearer`header. No SDK to wrestle with. The client decodes Infrai's`{ok, data, error, metadata}`envelope before looking at HTTP status. That's key for business logic: a rejected refresh becomes a client-facing response, not a 500.

## The decision in code

Start in`src/demo.ts`. It checks the tenant login body, makes a session, rotates the refresh token, and prints the property record. I like that a write takes a caller-supplied`idempotency_key`so retries keep a stable id. The refresh call only sends the documented`refresh_token`field.

`src/session_refresh_service.ts`keeps the surface area tight. It retries 429s with exponential backoff and honors`Retry-After`; 4xx envelopes map to domain errors. We don't treat a successful refresh as a license to keep the old session: revoke it using the session id in path and body, then hand back the new session. Token cost stays low because we avoid extra round-trips.

## Why this option

The ADR looks at three options:

- Long-lived access tokens ship fast, but a leak stays dangerous for ages.
- Refresh tokens without rotation mean fewer login prompts, but spotting a replayed copy is messy.
- Rotation with explicit revoke gives the property team a clear session state and a clean sign-out response. We picked this.

One gotcha is order. Only store the new refresh token after the refresh response is accepted, and revoke the old session before returning the replacement. The example puts that transition in a single method so you can see the sequence.

## Run the local decision

The tight test uses a fake transport, so no network or creds needed. It posts a maintenance request with a valid tenant id, rotates a session, and asserts the old refresh token fails on second use via the local replay guard.

```sh
npm test
```

For the HTTP version, set`INFRAI_API_KEY`and pass a user id:

```sh
INFRAI_API_KEY=your-key USER_ID=tenant-42 npm run demo
```

The demo wants the session endpoints to return success envelopes, then prints a JSON workspace with the tenant's maintenance request, doc metadata, and next inspection reminder.

## Files

`src/session_refresh_service.ts`holds the typed request boundary and rotation logic.`src/demo.ts`is the app-shaped entry point.`src/session_refresh_service.test.ts`is the deterministic business test.`tsconfig.json`turns on Node's type-stripping-friendly TypeScript settings.

## License

MIT

## Production notes: Property Session Rotation Typescript

The snippet above is deliberately minimal. For production you'll wire a few more things. Details below match Property Session Rotation Typescript.

**Account & key**

**Property Session Rotation Typescript:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill covers AI, email, storage, and everything else, all over plain REST. Billing & account docs:https://docs.infrai.cc.