import { pushPreferencesFromTransport, type PushGroup } from "@/domain/pushPreferences";

async function request(patch?: Partial<Record<PushGroup, boolean>>) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/push/preferences`,
    {
      method: patch ? "PATCH" : "GET",
      credentials: "include",
      cache: "no-store",
      ...(patch
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }
        : {}),
    },
  );
  if (!response.ok) throw new Error("Could not access notification settings.");
  return pushPreferencesFromTransport(await response.json());
}

export const pushPreferencesRepository = {
  read: () => request(),
  update: (patch: Partial<Record<PushGroup, boolean>>) => request(patch),
};
