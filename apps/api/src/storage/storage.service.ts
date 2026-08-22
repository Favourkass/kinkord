import { Injectable } from "@nestjs/common";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class StorageService {
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-1" });
  private readonly bucket = process.env.MEDIA_BUCKET ?? "";

  /** Presigned PUT for a direct browser upload. Expires in 10 minutes. */
  async presignUpload(key: string, contentType: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 600 },
    );
  }

  /** Presigned GET for serving private media. Expires in 1 hour. */
  async presignDownload(key: string): Promise<string> {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 3600,
    });
  }
}
