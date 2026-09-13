import type { BlobUploadResult, StorageService } from "@/types/storage";

/**
 * Abstraction over object storage. Phase 1 is a no-op stub;
 * Phase 2 will implement Vercel Blob.
 */
export class NoopStorageService implements StorageService {
  async upload(): Promise<BlobUploadResult> {
    throw new Error("StorageService not configured. Set BLOB_READ_WRITE_TOKEN in Phase 2.");
  }

  async delete(): Promise<void> {
    throw new Error("StorageService not configured.");
  }
}

export const storageService: StorageService = new NoopStorageService();
