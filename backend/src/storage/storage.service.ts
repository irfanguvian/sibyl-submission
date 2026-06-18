import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../env";

/** Thin wrapper over an S3-compatible object store (MinIO in dev). */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  // Separate client whose endpoint is browser-reachable, used only to sign
  // download URLs. Equals `client` unless S3_PUBLIC_ENDPOINT splits them.
  private readonly presignClient: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get("S3_BUCKET", { infer: true });
    const region = config.get("S3_REGION", { infer: true });
    const forcePathStyle = config.get("S3_FORCE_PATH_STYLE", { infer: true });
    const credentials = {
      accessKeyId: config.get("S3_ACCESS_KEY", { infer: true }),
      secretAccessKey: config.get("S3_SECRET_KEY", { infer: true }),
    };
    const endpoint = config.get("S3_ENDPOINT", { infer: true });
    const publicEndpoint = config.get("S3_PUBLIC_ENDPOINT", { infer: true }) ?? endpoint;

    this.client = new S3Client({ endpoint, region, forcePathStyle, credentials });
    this.presignClient =
      publicEndpoint === endpoint
        ? this.client
        : new S3Client({ endpoint: publicEndpoint, region, forcePathStyle, credentials });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /** A short-lived presigned GET URL (default 60s) for direct download. */
  presignedGetUrl(key: string, expiresIn = 60): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      {
        expiresIn,
      },
    );
  }
}
