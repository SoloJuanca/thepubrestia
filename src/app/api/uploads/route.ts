import { NextResponse } from "next/server";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import {
  isBlobConfigured,
  storageService,
} from "@/services/storage.service";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await assertPermission("menu", "update");

    if (!isBlobConfigured()) {
      return NextResponse.json(
        {
          error:
            "Vercel Blob no configurado. Define BLOB_READ_WRITE_TOKEN o pega una URL de imagen.",
        },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "menu");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Archivo requerido (campo file)." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Tipo de imagen no permitido. Usa JPG, PNG, WebP o GIF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen supera 4 MB." },
        { status: 400 },
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uploaded = await storageService.upload(file, {
      pathname: `${folder}/${Date.now()}-${safeName}`,
      contentType: file.type,
    });

    return NextResponse.json(uploaded);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "No se pudo subir la imagen." },
      { status: 500 },
    );
  }
}
