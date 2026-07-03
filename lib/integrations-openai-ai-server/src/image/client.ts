import fs from "node:fs";
import { toFile } from "openai";
import { Buffer } from "node:buffer";
import { createOpenAIClient } from "../resolveOpenAI";

export const openai = createOpenAIClient();

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

/**
 * Edit a single in-memory image (no filesystem access — serverless-safe).
 * Returns the edited image as a Buffer (PNG).
 */
export async function editImageBuffer(
  imageBuffer: Buffer,
  prompt: string,
  options?: {
    mimeType?: string;
    size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
    quality?: "low" | "medium" | "high" | "auto";
  },
): Promise<Buffer> {
  const mimeType = options?.mimeType ?? "image/jpeg";
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const image = await toFile(imageBuffer, `photo.${ext}`, { type: mimeType });

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image,
    prompt,
    ...(options?.size ? { size: options.size } : {}),
    ...(options?.quality ? { quality: options.quality } : {}),
  });

  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      })
    )
  );

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
