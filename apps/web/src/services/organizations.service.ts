import { api } from "./apiClient";
import { isOfficialOrganization } from "./organization-placeholder.service";

/** GET /members/organizations: an organization's account, by the country it speaks for. */
export interface OrganizationPM {
  userId: string;
  username: string | null;
  displayName: string;
  country: string | null;
}

const NONE: ReadonlySet<string> = new Set();

/**
 * The organizations' accounts, read once a session and shared by every screen
 * that shows a name: there are few, the founders make them, and a post, a
 * comment or a chat row only needs to know whether its author is one. A failed
 * read is tried again the next time a screen asks.
 */
function createOrganizationsStore() {
  let known: ReadonlySet<string> = NONE;
  let reading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: (): ReadonlySet<string> => known,
    load(): Promise<void> {
      reading ??= api
        .get<{ items: OrganizationPM[] }>("/members/organizations")
        .then((res) => {
          known = new Set((res?.items ?? []).map((o) => o.userId));
          listeners.forEach((listener) => listener());
        })
        .catch(() => {
          reading = null;
        });
      return reading;
    },
  };
}

export const organizationsStore = createOrganizationsStore();

/** The empty set, for the server render. */
export const noOrganizations = (): ReadonlySet<string> => NONE;

/**
 * Whether this account is an organization's: one the founders made, or the
 * official Kinkord account the deployment names.
 */
export function isOrganization(
  userId: string | null | undefined,
  known: ReadonlySet<string>,
): boolean {
  return Boolean(userId && known.has(userId)) || isOfficialOrganization(userId);
}
