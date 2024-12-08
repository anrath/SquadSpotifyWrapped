'use client';

import { useEffect, useState } from 'react';

interface NowPlayingData {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumImageUrl?: string;
  songUrl?: string;
}

export function NowPlaying() {
  const [data, setData] = useState<NowPlayingData | null>(null);

  useEffect(() => {
    const fetchNowPlaying = async () => {
      try {
        const response = await fetch('/api/spotify');
        const data = await response.json();
        setData(data);
      } catch (error) {
        console.error('Error fetching now playing:', error);
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (!data?.isPlaying) return null;

  return (
    <div className="flex items-center gap-4 rounded-lg bg-green-50 p-4">
      {data.albumImageUrl && (
        <img
          src={data.albumImageUrl}
          alt={`${data.album} album art`}
          className="h-16 w-16 rounded-md"
        />
      )}
      <div>
        <p className="text-sm text-gray-500">Now Playing on Spotify</p>
        <a
          href={data.songUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
        >
          {data.title}
        </a>
        <p className="text-sm text-gray-600">{data.artist}</p>
      </div>
    </div>
  );
} 