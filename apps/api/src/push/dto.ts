import { z } from "zod";

const base64Url = /^[A-Za-z0-9_-]+=*$/;

/** What a browser's PushSubscription.toJSON() gives, minus what we don't keep. */
export const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://", "Push endpoints are https.").max(2048),
  keys: z.object({
    p256dh: z.string().regex(base64Url).max(256),
    auth: z.string().regex(base64Url).max(64),
  }),
});

export const endpointSchema = z.object({
  endpoint: z.string().url().max(2048),
});
