import { describe, expect, it } from "vitest";
import { connectionProtocols, eventsFromFrame } from "./realtime";

describe("connectionProtocols", () => {
  it("offers AppSync's protocol and the auth header as base64url JSON", () => {
    const [protocol, header] = connectionProtocols({ host: "h.example.com", token: "v1.a.b" });
    expect(protocol).toBe("aws-appsync-event-ws");
    expect(header).toMatch(/^header-[A-Za-z0-9_-]+$/);
    const json = atob(header.slice("header-".length).replace(/-/g, "+").replace(/_/g, "/"));
    expect(JSON.parse(json)).toEqual({ host: "h.example.com", Authorization: "v1.a.b" });
  });
});

describe("eventsFromFrame", () => {
  const event = JSON.stringify({ type: "message", conversationId: "c1" });

  it("reads our events from a data frame, as a string or a list of them", () => {
    expect(eventsFromFrame({ type: "data", id: "chat", event })).toEqual([
      { type: "message", conversationId: "c1" },
    ]);
    expect(eventsFromFrame({ type: "data", id: "chat", event: [event, event] })).toHaveLength(2);
  });

  it("reads an inbox change, which carries nothing but its kind", () => {
    expect(
      eventsFromFrame({ type: "data", event: JSON.stringify({ type: "notification", id: "x" }) }),
    ).toEqual([{ type: "notification" }]);
  });

  it("ignores other frames, malformed events and unknown kinds", () => {
    expect(eventsFromFrame({ type: "ka" })).toEqual([]);
    expect(eventsFromFrame(null)).toEqual([]);
    expect(eventsFromFrame({ type: "data", event: "{not json" })).toEqual([]);
    expect(eventsFromFrame({ type: "data", event: JSON.stringify({ type: "typing" }) })).toEqual(
      [],
    );
    expect(
      eventsFromFrame({
        type: "data",
        event: JSON.stringify({ type: "message", conversationId: 1 }),
      }),
    ).toEqual([]);
  });
});

it("accepts only valid transient typing hints", () => {
  const event = { type: "typing", conversationId: "c1", typing: true, expiresAt: 12345 };
  expect(eventsFromFrame({ type: "data", event: [JSON.stringify(event)] })).toEqual([event]);
  expect(
    eventsFromFrame({
      type: "data",
      event: [
        { ...event, expiresAt: "bad" },
        { ...event, typing: "yes" },
      ],
    }),
  ).toEqual([]);
});
