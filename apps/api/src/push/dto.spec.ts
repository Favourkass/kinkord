import { describe, expect, it } from "vitest";
import { endpointSchema, subscriptionSchema } from "./dto";

const SUB = {
  endpoint: "https://web.push.apple.com/QGuQyavXutnMH",
  keys: {
    p256dh:
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
    auth: "tBHItJI5svbpez7KI4CCXg==",
  },
};

describe("subscriptionSchema", () => {
  it("accepts what PushSubscription.toJSON() gives", () => {
    expect(subscriptionSchema.safeParse(SUB).success).toBe(true);
  });

  it("refuses non-https endpoints and malformed keys", () => {
    expect(subscriptionSchema.safeParse({ ...SUB, endpoint: "http://x.example/a" }).success).toBe(
      false,
    );
    expect(
      subscriptionSchema.safeParse({ ...SUB, keys: { p256dh: "a b", auth: "c" } }).success,
    ).toBe(false);
    expect(subscriptionSchema.safeParse({ endpoint: SUB.endpoint }).success).toBe(false);
  });
});

describe("endpointSchema", () => {
  it("needs a URL", () => {
    expect(endpointSchema.safeParse({ endpoint: SUB.endpoint }).success).toBe(true);
    expect(endpointSchema.safeParse({ endpoint: "nope" }).success).toBe(false);
  });
});
