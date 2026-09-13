import { del, put } from "@vercel/blob";
import type { BlobUploadResult, StorageService } from "@/types/storage";

function toUploadBody(
  file: File | Blob | Buffer,
): File | Blob | Buffer {
  return file;
}

export class VercelBlobStorageService implements StorageService {
  async upload(
    file: File | Blob | Buffer,
    options?: { pathname?: string; contentType?: string },
  ): Promise<BlobUploadResult> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN no configurado. Agrega el token de Vercel Blob.",
      );
    }

    const pathname =
      options?.pathname ??
      `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await put(pathname, toUploadBody(file), {
      access: "public",
      token,
      contentType: options?.contentType,
      addRandomSuffix: true,
    });

    return {
      url: result.url,
      pathname: result.pathname,
      contentType: result.contentType,
    };
  }

  async delete(pathname: string): Promise<void> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN no configurado.");
    }
    await del(pathname, { token });
  }
}

export class NoopStorageService implements StorageService {
  async upload(): Promise<BlobUploadResult> {
    throw new Error(
      "StorageService no configurado. Define BLOB_READ_WRITE_TOKEN.",
    );
  }

  async delete(): Promise<void> {
    throw new Error("StorageService no configurado.");
  }
}

export function createStorageService(): StorageService {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new VercelBlobStorageService();
  }
  return new NoopStorageService();
}

export const storageService: StorageService = createStorageService();

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
