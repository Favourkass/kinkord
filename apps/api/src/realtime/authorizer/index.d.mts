// Types for index.mjs, so the TypeScript specs can import it.
export interface AuthorizerEvent {
  authorizationToken?: string;
  requestContext?: {
    operation?: "EVENT_CONNECT" | "EVENT_SUBSCRIBE" | "EVENT_PUBLISH";
    channel?: string | null;
    channelNamespaceName?: string | null;
  };
}

export interface AuthorizerResult {
  isAuthorized: boolean;
  ttlOverride?: number;
}

export function channelFor(userId: string): string | null;
export function verify(
  token: string | undefined,
  key: string,
  nowMs: number,
): { sub: string; exp: number } | null;
export function authorize(event: AuthorizerEvent, key: string, nowMs: number): AuthorizerResult;
export function handler(event: AuthorizerEvent): Promise<AuthorizerResult>;
