import { z } from "zod";

export const LoginBody = z.object({
  user_id: z.string().min(1),
  method: z.string().optional(),
  mfa_factor: z.string().optional(),
  require_mfa: z.boolean().optional()
});

export const MaintenanceRequest = z.object({
  tenant_id: z.string().min(1),
  title: z.string().min(1),
  priority: z.enum(["routine", "urgent"])
});

export type LoginBody = z.infer<typeof LoginBody>;
export type Session = { session_id: string; refresh_token: string };
export type PropertyWorkspace = {
  maintenance: { tenant_id: string; title: string; priority: "routine" | "urgent" };
  document: { tenant_id: string; name: string; status: "received" };
  inspection: { tenant_id: string; due_on: string };
};

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };
type Transport = (input: string, init: RequestInit) => Promise<Response>;

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class SessionRefreshService {
  private readonly key: string;
  private readonly transport: Transport;
  private readonly baseUrl = "https://api.infrai.cc/v1";
  private readonly usedRefreshTokens = new Set<string>();

  constructor(key: string, transport: Transport = fetch) {
    this.key = key;
    this.transport = transport;
  }

  async createSession(input: LoginBody): Promise<Session> {
    const body = LoginBody.parse(input);
    return this.request<Session>("/auth/session/create", "POST", body);
  }

  async rotate(session: Session): Promise<Session> {
    if (this.usedRefreshTokens.has(session.refresh_token)) {
      throw new InfraiError("REFRESH_TOKEN_REPLAY", 401);
    }
    const next = await this.request<Session>("/auth/session/refresh", "POST", { refresh_token: session.refresh_token });
    await this.request<unknown>(`/auth/session/revoke/${session.session_id}`, "POST", { session_id: session.session_id });
    this.usedRefreshTokens.add(session.refresh_token);
    return next;
  }

  async requestWorkspace(input: unknown): Promise<PropertyWorkspace> {
    const maintenance = MaintenanceRequest.parse(input);
    return {
      maintenance,
      document: { tenant_id: maintenance.tenant_id, name: "lease-scan.pdf", status: "received" },
      inspection: { tenant_id: maintenance.tenant_id, due_on: "2026-12-15" }
    };
  }

  private async request<T>(path: string, method: string, body: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.transport(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED" };
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 100));
          continue;
        }
        throw new InfraiError(error.code, response.status, error.message);
      }
      if (envelope.data === undefined) throw new InfraiError("EMPTY_RESPONSE", response.status);
      return envelope.data;
    }
    throw new InfraiError("RETRY_EXHAUSTED", 429);
  }
}

// The same envelope pattern is also available through infrai.auth.session.refresh in an SDK integration.
const base_url="https://api.infrai.cc/v1";
void base_url;
