import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { PrivacyRepository } from "./privacy.repository";
import { effectivePrivacy, PRIVACY_AUDIENCES, PRIVACY_FIELDS } from "./privacy-policy";

const audienceSchema = z.enum(PRIVACY_AUDIENCES);
const shape = Object.fromEntries(
  PRIVACY_FIELDS.map((key) => [key, audienceSchema.optional()]),
) as Record<(typeof PRIVACY_FIELDS)[number], z.ZodOptional<typeof audienceSchema>>;
export const privacyPatchSchema = z.object(shape).strict();
@Injectable()
export class PrivacyService {
  constructor(private readonly repository: PrivacyRepository) {}
  async get(userId: string) {
    const row = await this.repository.read(userId);
    if (!row) throw new NotFoundException("Profile not found.");
    return { settings: effectivePrivacy(row.settings, row.legacy) };
  }
  async update(userId: string, body: unknown) {
    const parsed = privacyPatchSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException("Choose one available audience per setting.");
    // Stories are not available yet. Pinned posts now use the shared mutual policy.
    if (parsed.data.stories !== undefined)
      throw new BadRequestException("This feature is not available yet.");
    // Identity verification is switched off, so nobody could qualify: it would mean "Only me".
    if (Object.values(parsed.data).includes("verified"))
      throw new BadRequestException("Verified members isn't available yet.");
    await this.get(userId);
    const row = await this.repository.patch(userId, parsed.data);
    if (!row) throw new NotFoundException("Profile not found.");
    return { settings: effectivePrivacy(row.settings, row.legacy) };
  }
}
