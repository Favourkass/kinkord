-- Rates are integer kobo. Existing transactions retain their stored amounts.
INSERT INTO "wallet_settings" ("id", "rates", "minimum_kobo", "enabled", "updated_by")
VALUES (1, '{"coin":{"buy":1000,"redeem":800},"star":{"buy":10000,"redeem":8000},"crown":{"buy":100000,"redeem":80000}}'::jsonb, 10000000, 0, 'system:wallet-naira-rates')
ON CONFLICT ("id") DO UPDATE SET
  "rates" = EXCLUDED."rates",
  "minimum_kobo" = EXCLUDED."minimum_kobo",
  "updated_at" = now();
