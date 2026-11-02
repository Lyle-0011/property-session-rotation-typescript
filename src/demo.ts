import { SessionRefreshService } from "./session_refresh_service.ts";

const key = process.env.INFRAI_API_KEY;
const userId = process.env.USER_ID;
if (!key || !userId) throw new Error("Set INFRAI_API_KEY and USER_ID");

const service = new SessionRefreshService(key);
const session = await service.createSession({ user_id: userId, method: "password", require_mfa: false });
const rotated = await service.rotate(session);
const workspace = await service.requestWorkspace({ tenant_id: userId, title: "Kitchen tap needs attention", priority: "routine" });
console.log(JSON.stringify({ rotated_session: rotated.session_id, workspace }, null, 2));
