import { ImageResponse } from "next/og";

// Image metadata
export const size = {
  width: 1200,
  height: 630,
};

// Image generation
export async function GenerateImage(params: {
  title: string;
  description?: string;
}) {
  // Font
  const interSemiBold = fetch(
    new URL("../fonts/Inter-SemiBold.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          fontSize: 128,
          background: "black",
          width: "100%",
          height: "100%",
          display: "flex",
          textAlign: "center",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <span style={{ fontWeight: 600 }}>{params.title}</span>
          {params.description && (
            <span style={{ fontSize: 36, fontWeight: 600 }}>
              {params.description}
            </span>
          )}
        </div>
      </div>
    ),
    // ImageResponse options
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: await interSemiBold,
          style: "normal",
          weight: 600,
        }
      ],
    },
  );
}
