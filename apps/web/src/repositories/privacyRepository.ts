import { privacyFromTransport, type PrivacyField, type PrivacyAudience } from "@/domain/privacy";
type PrivacySettingsPatch = Partial<Record<PrivacyField, PrivacyAudience>>;
async function request(patch?: PrivacySettingsPatch) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/privacy`,
    {
      method: patch ? "PATCH" : "GET",
      credentials: "include",
      cache: "no-store",
      ...(patch
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }
        : {}),
    },
  );
  if (!response.ok) throw new Error("Could not access privacy settings.");
  return privacyFromTransport(await response.json());
}
export const privacyRepository = {
  read: () => request(),
  update: (patch: PrivacySettingsPatch) => request(patch),
};
