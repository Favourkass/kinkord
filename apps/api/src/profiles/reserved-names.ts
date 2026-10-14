/**
 * "Kinkord" belongs to Kinkord's own account, so no member may sign up with it
 * in their username or display name, or change either to include it. Only the
 * letters count, in any case: "Kin_kord", "KINKORD official" and
 * "k.i.n.k.o.r.d" all contain it.
 *
 * The API can't tell which account is the official one (the web knows it by a
 * build setting), so a name that already contains the word may be kept: that
 * is how the official account keeps its own.
 */
const RESERVED = "kinkord";

export const NAME_RESERVED = "That name is reserved.";

/** Whether the name contains "kinkord" once everything but its letters is dropped. */
export function isReservedName(name: string | null | undefined): boolean {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .includes(RESERVED);
}

/**
 * Whether naming a member `next` takes the reserved word: always for a new
 * account (nothing current), and for a change only when the current name
 * doesn't contain it already.
 */
export function takesReservedName(next: string, current?: string | null): boolean {
  return isReservedName(next) && !isReservedName(current);
}
