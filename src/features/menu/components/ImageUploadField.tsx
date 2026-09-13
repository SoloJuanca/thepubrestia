"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  label?: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  folder?: string;
  blobEnabled: boolean;
  onChange: (next: { imageUrl: string; imagePath: string | null }) => void;
};

export function ImageUploadField({
  label = "Imagen",
  imageUrl,
  imagePath,
  folder = "menu",
  blobEnabled,
  onChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState(imageUrl ?? "");

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    if (!blobEnabled) {
      toast.error(
        "Blob no configurado. Pega una URL o define BLOB_READ_WRITE_TOKEN.",
      );
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("folder", folder);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = (await res.json()) as {
        url?: string;
        pathname?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Error al subir");
      }
      setUrlDraft(json.url);
      onChange({ imageUrl: json.url, imagePath: json.pathname ?? null });
      toast.success("Imagen subida");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al subir");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="h-28 w-28 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          Sin imagen
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          type="url"
          placeholder="https://… o deja vacío"
          value={urlDraft}
          onChange={(e) => {
            setUrlDraft(e.target.value);
            onChange({
              imageUrl: e.target.value,
              imagePath: imagePath ?? null,
            });
          }}
        />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={uploading || !blobEnabled}
            onChange={(e) => onFileChange(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading || !blobEnabled}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Subiendo…" : "Subir archivo"}
          </Button>
        </div>
      </div>
      {!blobEnabled ? (
        <p className="text-xs text-muted-foreground">
          Subida a Vercel Blob desactivada. Usa una URL pública o configura
          BLOB_READ_WRITE_TOKEN.
        </p>
      ) : null}
    </div>
  );
}
