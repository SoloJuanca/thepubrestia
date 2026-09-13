export type BlobUploadResult = {
  url: string;
  pathname: string;
  contentType?: string;
  size?: number;
};

export type StorageService = {
  upload(
    file: File | Blob | Buffer,
    options?: { pathname?: string; contentType?: string },
  ): Promise<BlobUploadResult>;
  delete(pathname: string): Promise<void>;
};
