import { describe, expect, it } from "vitest";
import {
  historyQuerySchema,
  MESSAGE_BODY_MAX,
  photoUploadSchema,
  sendMessageSchema,
  startDmSchema,
} from "./dto";

describe("sendMessageSchema", () => {
  it("trims the text and refuses an empty message", () => {
    expect(sendMessageSchema.parse({ body: "  hi  " }).body).toBe("hi");
    expect(sendMessageSchema.safeParse({ body: "   " }).success).toBe(false);
  });

  it("refuses a message longer than the limit", () => {
    expect(sendMessageSchema.safeParse({ body: "x".repeat(MESSAGE_BODY_MAX + 1) }).success).toBe(
      false,
    );
  });

  it("drops fields it doesn't know, like a post's media list", () => {
    const parsed = sendMessageSchema.parse({ body: "hi", media: [{ key: "posts/u9/a.jpg" }] });
    expect(parsed).toEqual({ body: "hi" });
  });

  it("takes a photo on its own, or with the text as its caption", () => {
    expect(sendMessageSchema.parse({ photoKey: " chat/c1/u1/a.jpg " })).toEqual({
      body: "",
      photoKey: "chat/c1/u1/a.jpg",
    });
    expect(sendMessageSchema.parse({ body: "look", photoKey: "chat/c1/u1/a.jpg" })).toMatchObject({
      body: "look",
      photoKey: "chat/c1/u1/a.jpg",
    });
  });

  it("refuses a message with neither text nor a photo", () => {
    const parsed = sendMessageSchema.safeParse({ body: " ", photoKey: "" });
    expect(parsed.success).toBe(false);
    expect(sendMessageSchema.safeParse({}).error?.issues[0]?.message).toBe(
      "Write a message first.",
    );
  });
});

describe("photoUploadSchema", () => {
  it("needs the photo's type, and takes its size when the browser knows it", () => {
    expect(photoUploadSchema.parse({ contentType: "image/jpeg", contentLength: 2048 })).toEqual({
      contentType: "image/jpeg",
      contentLength: 2048,
    });
    expect(photoUploadSchema.safeParse({}).success).toBe(false);
    expect(
      photoUploadSchema.safeParse({ contentType: "image/jpeg", contentLength: 0 }).success,
    ).toBe(false);
  });
});

describe("historyQuerySchema", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("reads the page size from the query string, with a default", () => {
    expect(historyQuerySchema.parse({}).limit).toBe(50);
    expect(historyQuerySchema.parse({ limit: "20" }).limit).toBe(20);
    expect(historyQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });

  it("takes message ids as cursors, one direction at a time", () => {
    expect(historyQuerySchema.parse({ after: id }).after).toBe(id);
    expect(historyQuerySchema.safeParse({ before: "yesterday" }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ before: id, after: id }).success).toBe(false);
  });
});

describe("startDmSchema", () => {
  it("needs the member to open a thread with", () => {
    expect(startDmSchema.safeParse({}).success).toBe(false);
    expect(startDmSchema.parse({ userId: " u2 " }).userId).toBe("u2");
  });
});
