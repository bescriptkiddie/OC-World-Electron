import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImageGenPayload, ImageGenResult } from "../../src/types";

function getEnvValue(key: string): string {
  return process.env[key] ?? "";
}

function resolveAvatarsDir() {
  return path.join(process.cwd(), "oc-data", "avatars");
}

export async function generateImage(
  payload: ImageGenPayload,
  characterId = "char-001",
): Promise<ImageGenResult> {
  const apiKey = getEnvValue("MARSWAVE_API_KEY");
  if (!apiKey) {
    throw new Error("MARSWAVE_API_KEY not configured");
  }

  const response = await fetch(
    "https://api.marswave.ai/openapi/v1/images/generation",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-image-2",
        prompt: payload.prompt,
        imageConfig: {
          aspectRatio: payload.aspectRatio || "1:1",
          imageSize: payload.imageSize || "1K",
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image gen failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

  if (!part?.data || !part?.mimeType) {
    throw new Error("Unexpected image gen response format");
  }

  const ext = part.mimeType.includes("png") ? "png" : "jpg";
  const fileName = `${characterId}.${ext}`;
  const dir = resolveAvatarsDir();
  const filePath = path.join(dir, fileName);

  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(part.data, "base64");
  await writeFile(filePath, buffer);

  return {
    imageBase64: part.data,
    mimeType: part.mimeType,
    savedPath: filePath,
  };
}
