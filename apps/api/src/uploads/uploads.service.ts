import { Injectable, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { attachments as attTbl } from '../db/schema';

const PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT;

@Injectable()
export class UploadsService {
  private s3: S3Client;
  private bucket = process.env.S3_BUCKET!;

  constructor(private db: DbService) {
    this.s3 = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    });
  }

  async presignPut(userId: string, input: { filename: string; mime: string; size: number }) {
    const id = randomUUID();
    const safe = input.filename.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `u/${userId}/${id}/${safe}`;
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: input.mime }),
      { expiresIn: 600 },
    );

    await this.db.db.insert(attTbl).values({
      id,
      uploaderId: userId,
      key,
      filename: input.filename,
      mime: input.mime,
      size: input.size,
    });

    return { attachmentId: id, key, uploadUrl };
  }

  async presignGet(key: string) {
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 3600 },
    );
    // In dev, swap the internal docker hostname for the browser-visible one.
    if (PUBLIC_ENDPOINT) return url.replace(process.env.S3_ENDPOINT!, PUBLIC_ENDPOINT);
    return url;
  }

  async attachToMessage(attachmentIds: string[], messageId: string, userId: string) {
    if (!attachmentIds.length) return;
    await this.db.db
      .update(attTbl)
      .set({ messageId })
      .where(
        and(
          inArray(attTbl.id, attachmentIds),
          eq(attTbl.uploaderId, userId),
          isNull(attTbl.messageId),
        ),
      );
  }

  async decorate(atts: { key: string }[]) {
    return Promise.all(
      atts.map(async (a) => ({ ...a, url: await this.presignGet(a.key) })),
    );
  }

  async byIds(ids: string[]) {
    if (!ids.length) return [];
    return this.db.db.select().from(attTbl).where(inArray(attTbl.id, ids));
  }
}