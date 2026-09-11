CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text NOT NULL DEFAULT 'dm',
  "dm_key" text UNIQUE,
  "title" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_message_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "conversation_participants" (
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "last_read_message_id" uuid,
  PRIMARY KEY ("conversation_id","user_id")
);
CREATE INDEX IF NOT EXISTS "cp_user_idx" ON "conversation_participants"("user_id");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "sender_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text,
  "client_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "messages_conv_created_idx" ON "messages"("conversation_id","created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "messages_sender_client_uidx" ON "messages"("sender_id","client_id") WHERE "client_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid REFERENCES "messages"("id") ON DELETE CASCADE,
  "uploader_id" uuid NOT NULL REFERENCES "users"("id"),
  "key" text NOT NULL,
  "filename" text NOT NULL,
  "mime" text NOT NULL,
  "size" bigint NOT NULL,
  "width" integer,
  "height" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "attachments_message_idx" ON "attachments"("message_id");