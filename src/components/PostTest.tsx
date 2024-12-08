"use client";

import { useState } from "react";

export function PostTest() {
  const [result, setResult] = useState<string>("");
  const [playlistId, setPlaylistId] = useState<string>("");

  const dummyData = [
    {
      "Top Artists": ["Drake", "The Weeknd"],
      "Top Songs": ["God's Plan", "Blinding Lights"],
    },
    {
      "Top Artists": ["Dua Lipa", "Harry Styles"],
      "Top Songs": ["Levitating", "Watermelon Sugar"],
    },
  ];

  const handleTest = async () => {
    try {
      const response = await fetch("/api/spotify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: dummyData }),
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
      setPlaylistId(data.playlistId);
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
      );
    }
  };

  return (
    <div className="mb-8 flex flex-col items-center gap-4">
      <button
        onClick={handleTest}
        className="rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600"
      >
        Test Spotify API
      </button>
      {result && (
        <>
          <pre className="max-w-xl overflow-auto rounded p-4">{result}</pre>

          <iframe
            style={{ borderRadius: "12px" }}
            src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
            width="100%"
            height="352"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          ></iframe>
        </>
      )}
    </div>
  );
}
