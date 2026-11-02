import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

export async function normalizeSquareJpeg(body: unknown): Promise<Buffer> {
  const invalid = () =>
    new BadRequestException(
      "La imagen debe ser un JPEG cuadrado válido de hasta 512 KB.",
    );
  if (!Buffer.isBuffer(body) || body.length > 524288) throw invalid();
  try {
    const image = sharp(body, { failOn: "error", limitInputPixels: 512 * 512 });
    const metadata = await image.metadata();
    if (
      metadata.format !== "jpeg" ||
      metadata.width !== 512 ||
      metadata.height !== 512
    )
      throw invalid();
    const normalized = await image.jpeg({ quality: 85 }).toBuffer();
    if (normalized.length > 524288) throw invalid();
    return normalized;
  } catch {
    throw invalid();
  }
}
