import type { SignupRuleAction, SignupRuleKind } from "../db/schema";

export interface SignupRule {
  kind: SignupRuleKind;
  value: string;
  action: SignupRuleAction;
}

/** What we know about someone at the moment they try to join or verify. */
export interface SignupCandidate {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  ip?: string | null;
}

export interface SignupVerdict {
  action: "allow" | SignupRuleAction;
  matches: SignupRule[];
}

/** Shortest fragment a `name` rule may use; "tolu" would already catch half of Lagos. */
const MIN_NAME_FRAGMENT = 4;

/**
 * One canonical form per mailbox. Gmail ignores dots and anything after a `+`,
 * so `t.o.lu+kink@gmail.com` and `tolu@gmail.com` are the same inbox, and most
 * other providers honour `+` tags too. Without this, a blocked member gets back
 * in by adding a dot.
 */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  let local = email.slice(0, at);
  local = local.split("+")[0] || local;
  let domain = email.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replaceAll(".", "");
  return `${local}@${domain}`;
}

/**
 * E.164, e.g. `+2348031234567`. Sign-ups and codes already arrive that way;
 * this is for rules typed by hand, where a Nigerian number is as likely to be
 * written `0803 123 4567` or `234803…`.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  return `+${digits}`;
}

export function normalizeIp(raw: string): string {
  const ip = raw.trim().toLowerCase();
  // An IPv4 client seen over an IPv6 socket arrives as ::ffff:1.2.3.4.
  return ip.startsWith("::ffff:") && ip.includes(".") ? ip.slice("::ffff:".length) : ip;
}

function isPublicIp(ip: string): boolean {
  if (ip.includes(":")) return !(ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip));
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  // Carrier-grade NAT space: never a real client address on the internet.
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

/**
 * The address that reached AWS. Proxies append to X-Forwarded-For, so anything
 * a client writes into the header ends up on the left; scanning from the right
 * for the first public address skips AWS's own hops and ignores forgeries.
 * Taking the first entry, as most snippets do, would let a blocked member
 * choose their own IP.
 */
export function clientIpFrom(headers: Headers | null | undefined): string | null {
  const chain = headers?.get("x-forwarded-for");
  if (!chain) return null;
  const hops = chain
    .split(",")
    .map((hop) => normalizeIp(hop))
    .filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i -= 1) {
    if (isPublicIp(hops[i])) return hops[i];
  }
  return hops[0] ?? null;
}

/** Letters only, lowercased, accents folded: "Durówara_99" -> "durowara". */
function letters(s: string): string {
  return s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * Matches a candidate against the block list. Any `block` hit refuses; `flag`
 * hits alone let the attempt through for a human to look at. Rule values are
 * normalised here rather than on insert, so a moderator can paste an email or
 * number in whatever form they have it.
 */
export function evaluateSignup(candidate: SignupCandidate, rules: SignupRule[]): SignupVerdict {
  const email = candidate.email ? normalizeEmail(candidate.email) : null;
  const phone = candidate.phone ? normalizePhone(candidate.phone) : null;
  const ip = candidate.ip ? normalizeIp(candidate.ip) : null;
  const nameText = letters(candidate.name ?? "");
  const localText = email ? letters(email.slice(0, email.lastIndexOf("@"))) : "";

  const matches = rules.filter((rule) => {
    switch (rule.kind) {
      case "email":
        return email !== null && normalizeEmail(rule.value) === email;
      case "phone":
        return phone !== null && normalizePhone(rule.value) === phone;
      case "ip":
        return ip !== null && normalizeIp(rule.value) === ip;
      case "name": {
        const fragment = letters(rule.value);
        return (
          fragment.length >= MIN_NAME_FRAGMENT &&
          (nameText.includes(fragment) || localText.includes(fragment))
        );
      }
      default:
        return false;
    }
  });

  if (matches.some((m) => m.action === "block")) return { action: "block", matches };
  if (matches.length > 0) return { action: "flag", matches };
  return { action: "allow", matches };
}
