import { describe, expect, it } from "vitest";
import { isAllowedPhone } from "./phone-rules";

describe("isAllowedPhone", () => {
  it("takes Nigerian mobiles on every network's prefixes", () => {
    for (const n of [
      "+2348031234567", // 0803 MTN
      "+2348131234567", // 0813 MTN
      "+2347031234567", // 0703 MTN
      "+2349031234567", // 0903 MTN
      "+2349131234567", // 0913 MTN
      "+2348021234567", // 0802 Airtel
      "+2347011234567", // 0701 Airtel
      "+2348051234567", // 0805 Glo
      "+2348091234567", // 0809 9mobile
    ]) {
      expect(isAllowedPhone(n), n).toBe(true);
    }
  });

  it("refuses other countries, Nigerian landlines and wrong lengths, for now", () => {
    for (const n of [
      "+447700900123", // UK
      "+254703105232", // Kenya
      "+15551234567", // US
      "+233241234567", // Ghana
      "+23412345678", // Lagos landline
      "+234803123456", // one digit short
      "+23480312345678", // one digit long
      "+2346031234567", // not a mobile prefix
      "2348031234567", // no +
    ]) {
      expect(isAllowedPhone(n), n).toBe(false);
    }
  });
});
