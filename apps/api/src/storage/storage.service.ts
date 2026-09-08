import { Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Download URLs are identical within this window, so browsers can cache them. */
export const DOWNLOAD_URL_WINDOW_S = 3600;

export interface StoredObjectInfo {
  size: number;
  contentType: string | null;
}

@Injectable()
export class StorageService {
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-1" });
  private readonly bucket = process.env.MEDIA_BUCKET ?? "";

  /**
   * Presigned PUT for a direct browser upload. Expires in 10 minutes. When the
   * caller declares the byte size it is signed into the URL, so S3 refuses a body
   * of any other length — the server-side half of the upload size limit.
   */
  async presignUpload(key: string, contentType: string, contentLength?: number): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ...(contentLength ? { ContentLength: contentLength } : {}),
      }),
      { expiresIn: 600 },
    );
  }

  /**
   * Presigned GET for serving private media. The signing time is rounded down to
   * the hour, so every response within that hour carries the same URL and the
   * browser serves repeat views from its cache (S3 is told to allow an hour of
   * caching). Each URL is valid for two hours — at least an hour past its window.
   */
  async presignDownload(key: string, now: Date = new Date()): Promise<string> {
    const windowMs = DOWNLOAD_URL_WINDOW_S * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseCacheControl: `private, max-age=${DOWNLOAD_URL_WINDOW_S}`,
      }),
      { expiresIn: DOWNLOAD_URL_WINDOW_S * 2, signingDate: windowStart },
    );
  }

  /** Size and type of an uploaded object, or null when there is no such object. */
  async describe(key: string): Promise<StoredObjectInfo | null> {
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
  }

  /** Best-effort delete for rejected uploads; never throws. */
  async remove(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // Nothing to do — the object is orphaned at worst.
    }
  }
}

/**
 * HEAD on a missing key answers 404 with s3:ListBucket and 403 without it (the
 * API role only has object-level rights), so both mean "no such upload".
 */
function isMissing(e: unknown): boolean {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  const status = err?.$metadata?.httpStatusCode;
  return err?.name === "NotFound" || err?.name === "NoSuchKey" || status === 404 || status === 403;
}
