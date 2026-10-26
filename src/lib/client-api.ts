export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  url: string,
  opts: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { "x-session-token": opts.token } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(res.status, data.error ?? "May nangyaring mali. Subukan ulit.");
  }
  return data as T;
}

/**
 * localStorage is used ONLY to remember who you are in a room (your session token),
 * so a refresh doesn't kick you out. Game state itself always comes from the server.
 */
export const tokenKey = (code: string) => `bardagulan:token:${code.toUpperCase()}`;

export function loadToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}
export function saveToken(code: string, token: string) {
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    /* private mode: user will need to rejoin after refresh */
  }
}
export function clearToken(code: string) {
  try {
    localStorage.removeItem(tokenKey(code));
  } catch {
    /* ignore */
  }
}
