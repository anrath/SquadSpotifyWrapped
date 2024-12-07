import { GenerateImage } from "@/app/utils/og-generator";

export const runtime = "nodejs";

export const alt = "Corner Rounder - SquadSpotifyWrapped";
export const contentType = "image/png";

export const size = {
  width: 1200,
  height: 630,
};

// Image generation
export default async function Image() {
  return await GenerateImage({
    title: "Corner Rounder",
    description: "Round the corners of an image. For free.",
  });
}
