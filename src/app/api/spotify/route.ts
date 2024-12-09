import ky from "ky";
import { NextResponse } from "next/server";
import querystring from "querystring";

const {
  SPOTIFY_CLIENT_ID: client_id,
  SPOTIFY_CLIENT_SECRET: client_secret,
  SPOTIFY_REFRESH_TOKEN: refresh_token,
} = process.env;

const token = Buffer.from(`${client_id}:${client_secret}`).toString("base64");
const CREATE_PLAYLIST_ENDPOINT = `https://api.spotify.com/v1/me/playlists`;
const SEARCH_ENDPOINT = `https://api.spotify.com/v1/search`;
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;

type SpotifyData = {
  "Top Artists": string[];
  "Top Songs": string[];
};

type PlaylistCreationData = {
  data: SpotifyData[];
};

const getAccessToken = async () => {
  const res = await ky.post(TOKEN_ENDPOINT, {
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: querystring.stringify({
      grant_type: "refresh_token",
      refresh_token,
    }),
  }).json<{ access_token: string }>();

  return res.access_token;
};

const createPlaylist = async (name: string) => {
  const access_token = await getAccessToken();

  const playlist = await ky.post(CREATE_PLAYLIST_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    json: {
      name,
      description:
        "Generated with Squad Spotify Wrapped: spotify.kasralekan.com",
      public: true,
      collaborative: false,
    },
  }).json();

  return playlist;
};

const addTracksToPlaylist = async (playlistId: string, trackUris: string[]) => {
  const access_token = await getAccessToken();

  return ky.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    json: {
      uris: trackUris,
    },
  }).json();
};

const searchTrack = async (query: string, isArtist = false): Promise<Array<{
  album?: {
    album_type: string;
    artists: Array<{
      external_urls: { spotify: string };
      href: string;
      id: string;
      name: string;
      type: string;
      uri: string;
    }>;
    id: string;
    name: string;
    uri: string;
  };
  artists: Array<{
    external_urls: { spotify: string };
    href: string;
    id: string;
    name: string;
    type: string;
    uri: string;
  }>;
  available_markets?: string[];
  disc_number?: number;
  duration_ms?: number;
  explicit?: boolean;
  id: string;
  name: string;
  uri: string;
  popularity?: number;
  preview_url?: string | null;
  track_number?: number;
  type: string;
}>> => {
  const access_token = await getAccessToken();

  type SpotifySearchResponse = {
    artists?: {
      items: Array<{
        id: string;
      }>;
    };
    tracks?: {
      href: string;
      limit: number;
      next: string | null;
      offset: number;
      previous: string | null;
      total: number;
      items: Array<{
        album: {
          album_type: string;
          artists: Array<{
            external_urls: { spotify: string };
            href: string;
            id: string;
            name: string;
            type: string;
            uri: string;
          }>;
          id: string;
          name: string;
          uri: string;
        };
        artists: Array<{
          external_urls: { spotify: string };
          href: string;
          id: string;
          name: string;
          type: string;
          uri: string;
        }>;
        available_markets: string[];
        disc_number: number;
        duration_ms: number;
        explicit: boolean;
        id: string;
        name: string;
        uri: string;
        popularity: number;
        preview_url: string | null;
        track_number: number;
        type: string;
      }>;
    };
  };

  const searchParams = {
    q: isArtist ? `artist:${query}` : query,
    type: isArtist ? "artist" : "track",
    limit: 20,
  };

  const response = await ky.get(SEARCH_ENDPOINT, {
    searchParams,
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
  }).json<SpotifySearchResponse>();

  if (isArtist && response.artists?.items?.length > 0) {
    const artistId = response.artists?.items[0]?.id;
    const topTracksResponse = await ky.get(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    ).json<{ tracks: Array<unknown> }>();
    return topTracksResponse.tracks.slice(0, 5);
  }

  return response.tracks?.items ?? [];
};

const calculateLevenshteinDistance = (str1: string, str2: string): number => {
  const currentRow = Array.from({length: str2.length + 1}, (_, i) => i);
  let previousRow = new Array(str2.length + 1);

  for (let i = 0; i < str1.length; i++) {
    previousRow = [...currentRow];
    currentRow[0] = i + 1;
    
    for (let j = 0; j < str2.length; j++) {
      const substitutionCost = str1[i] === str2[j] ? 0 : 1;
      currentRow[j + 1] = Math.min(
        currentRow[j] + 1, // deletion
        previousRow[j + 1] + 1, // insertion 
        previousRow[j] + substitutionCost // substitution
      );
    }
  }

  return currentRow[str2.length] ?? 0;
};

export async function POST(request: Request) {
  try {
    const body: PlaylistCreationData = await request.json();

    if (!body.data || body.data.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: "No input data provided" }),
        { status: 400 },
      );
    }

    // Create new playlist
    const playlist = await createPlaylist("Squad Spotify Wrapped Playlist");
    const playlistId = playlist.id;
    const addedTrackUris = new Set<string>();

    // Process songs and artists in parallel
    const songPromises = body.data.map(async (userData) => {
      const userTopArtists = new Set(userData["Top Artists"].map(artist => artist.toLowerCase()));
      
      return Promise.all(userData["Top Songs"].map(async (song) => {
        const searchResults = await searchTrack(song);
        if (searchResults.length === 0) return null;

        // Filter results using fuzzy matching and calculate distances
        const relevantResults = searchResults.map((track) => {
          const trackName = (track as { name: string }).name;
          const searchTerm = song.endsWith("...") ? song.slice(0, -3) : song;
          const distance = song.endsWith("...")
            ? calculateLevenshteinDistance(trackName.slice(0, searchTerm.length), searchTerm)
            : calculateLevenshteinDistance(trackName, searchTerm);
          return { track, distance };
        });

        // Try to find a track from user's top artists
        const trackFromTopArtist = relevantResults.find(
          (result) => (result.track as { artists?: Array<{ name: string }> }).artists?.some(
            artist => userTopArtists.has(artist.name.toLowerCase())
          )
        )?.track;

        // If no track from top artists, use the one with lowest distance
        const bestMatch = relevantResults.length > 0 
          ? relevantResults.reduce((min, curr) => curr.distance < min.distance ? curr : min).track
          : searchResults[0];

        return trackFromTopArtist ?? bestMatch;
      }));
    });

    const artistPromises = body.data.map(async (userData) => {
      return Promise.all(userData["Top Artists"].map(async (artist) => {
        const artistTracks = await searchTrack(artist, true);
        return artistTracks.slice(0, 3); // Get top 3 tracks per artist
      }));
    });

    // Wait for all searches to complete
    const songResults = await Promise.all(songPromises);
    const artistResults = await Promise.all(artistPromises);

    // Flatten results and filter out nulls
    const allSongTracks = songResults.flat().filter((track): track is { uri: string } => track !== null);
    const allArtistTracks = artistResults.flat(2) as { uri: string }[];
    
    // Add songs first
    for (const track of allSongTracks) {
      if (!addedTrackUris.has(track.uri)) {
        await addTracksToPlaylist(playlistId, [track.uri]);
        addedTrackUris.add(track.uri);
      }
    }

    // Then add artist tracks
    for (const track of allArtistTracks) {
      if (!addedTrackUris.has(track.uri)) {
        await addTracksToPlaylist(playlistId, [track.uri]);
        addedTrackUris.add(track.uri);
      }
    }

    return new NextResponse(JSON.stringify({ playlistId }), { status: 200 });
  } catch (error) {
    console.error("Error creating playlist:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to create playlist" }),
      { status: 500 },
    );
  }
}
