import { mkdir, writeFile } from "node:fs/promises";
import type { ImageGenPayload, ImageGenResult } from "../../src/types";
import { resolveAvatarsDir } from "../capabilities/storage-paths";

function getEnvValue(key: string): string {
  return process.env[key] ?? "";
}

export async function generateImage(
  payload: ImageGenPayload,
  characterId = "char-001",
  dataRoot?: string,
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
          aspectRatio: "1:1",
          imageSize: "1K",
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
  const dir = resolveAvatarsDir(dataRoot);
  const filePath = `${dir}/${fileName}`;

  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(part.data, "base64");
  await writeFile(filePath, buffer);

  return {
    imageBase64: part.data,
    mimeType: part.mimeType,
    savedPath: filePath,
  };
}
