// SR-NET: the API location comes from the environment. Empty = same origin
// (in development, Vite proxies the API and /ws to the server).
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";

export function wsUrl(): string {
  const base = API_BASE ? new URL(API_BASE) : window.location;
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${base.host}/ws`;
}
