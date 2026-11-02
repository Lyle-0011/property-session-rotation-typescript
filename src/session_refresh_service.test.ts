import assert from "node:assert/strict";
import { InfraiError, SessionRefreshService } from "./session_refresh_service.ts";

const calls: Array<{ path: string; body: string }> = [];
const fakeTransport = async (input: string, init: RequestInit): Promise<Response> => {
  calls.push({ path: input, body: String(init.body) });
  const data = input.endsWith("/refresh")
    ? { session_id: "session-new", refresh_token: "refresh-new" }
    : { session_id: "session-old", refresh_token: "refresh-old" };
  return new Response(JSON.stringify({ ok: true, data, metadata: {} }), { status: 200, headers: { "content-type": "application/json" } });
};

const service = new SessionRefreshService("test-key", fakeTransport);
const first = await service.createSession({ user_id: "tenant-42" });
const next = await service.rotate(first);
assert.equal(next.session_id, "session-new");
assert.match(calls[1].body, /refresh_token/);
await assert.rejects(() => service.rotate(first), (error: unknown) => error instanceof InfraiError && error.code === "REFRESH_TOKEN_REPLAY");
console.log("rotation decision passed");
