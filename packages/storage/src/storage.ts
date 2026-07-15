import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface Storage {
  getUploadTarget(input: { key: string; contentType: string; documentId: string }): Promise<{ url: string; method: "PUT" }>;
  putObject(key: string, body: Buffer, contentType?: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  presignGet(input: { key: string; expiresInSeconds?: number }): Promise<string>;
}

class R2Storage implements Storage {
  private client: S3Client;
  private bucket: string;

  constructor(accountId: string, accessKeyId: string, secretAccessKey: string, bucket: string) {
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region: "auto",
    });
  }

  async getUploadTarget(input: { key: string; contentType: string }): Promise<{ url: string; method: "PUT" }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: 600 });
    return { url, method: "PUT" };
  }

  async putObject(key: string, body: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const res = await this.client.send(command);
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty body for R2 key ${key}`);
    return Buffer.from(bytes);
  }

  async presignGet(input: { key: string; expiresInSeconds?: number }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
    });
    return getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds ?? 3600 });
  }
}

class LocalStorage implements Storage {
  private uploadDir: string;

  constructor(uploadDir?: string) {
    if (uploadDir) {
      this.uploadDir = path.resolve(uploadDir);
    } else {
      // Default to <repo>/.data/uploads
      const here = path.dirname(fileURLToPath(import.meta.url));
      this.uploadDir = path.resolve(here, "../../../../../.data/uploads");
    }
  }

  private getFilePath(key: string): string {
    const safeKey = key.replace(/\.\./g, "");
    return path.join(this.uploadDir, safeKey);
  }

  async getUploadTarget(input: { key: string; contentType: string; documentId: string }): Promise<{ url: string; method: "PUT" }> {
    const url = `/api/uploads/${input.documentId}`;
    return { url, method: "PUT" };
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
  }

  async getObject(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    return await fs.readFile(filePath);
  }

  async presignGet(input: { key: string; expiresInSeconds?: number }): Promise<string> {
    const safeKey = input.key.replace(/\.\./g, "");
    return `/api/uploads/view?key=${encodeURIComponent(safeKey)}`;
  }
}

export function createStorage(env: Record<string, string | undefined> = process.env): Storage {
  const r2AccountId = env.R2_ACCOUNT_ID;
  const r2AccessKeyId = env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const r2Bucket = env.R2_BUCKET;

  if (r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2Bucket) {
    return new R2Storage(r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2Bucket);
  }

  return new LocalStorage(env.LOCAL_UPLOAD_DIR);
}
