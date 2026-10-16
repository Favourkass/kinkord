import type { FriendshipState, FriendRequestsPagePM } from "@/domain/friendship";
async function request<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${path}`,
    {
      method,
      credentials: "include",
      cache: "no-store",
      ...(body
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    },
  );
  if (!response.ok) throw new Error("Friend request could not be updated.");
  return response.json() as Promise<T>;
}

const memberPath = (username: string) =>
  `/friendships/${encodeURIComponent(username.replace(/^@/, ""))}`;
export const friendshipRepository = {
  request: (name: string) => request<{ friendship: FriendshipState }>(memberPath(name), "POST", {}),
  accept: (name: string) =>
    request<{ friendship: FriendshipState }>(`${memberPath(name)}/accept`, "POST", {}),
  dismiss: (name: string) =>
    request<{ friendship: FriendshipState }>(`${memberPath(name)}/request`, "DELETE"),
  remove: (name: string) => request<{ friendship: FriendshipState }>(memberPath(name), "DELETE"),
  requests: (direction: "incoming" | "outgoing", page: number) =>
    request<FriendRequestsPagePM>(`/friendships/requests?direction=${direction}&page=${page}`),
};
