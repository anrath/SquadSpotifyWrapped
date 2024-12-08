import axios from 'axios';
import { NextResponse } from 'next/server';
import querystring from 'querystring';

const {
  SPOTIFY_CLIENT_ID: client_id,
  SPOTIFY_CLIENT_SECRET: client_secret,
  SPOTIFY_REFRESH_TOKEN: refresh_token,
} = process.env;

const token = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
const NOW_PLAYING_ENDPOINT = `https://api.spotify.com/v1/me/player/currently-playing`;
const CREATE_PLAYLIST_ENDPOINT = `https://api.spotify.com/v1/me/playlists`;
const SEARCH_ENDPOINT = `https://api.spotify.com/v1/search`;
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;

type SpotifyData = {
  "Top Artists": string[];
  "Top Songs": string[];
}

interface SpotifyPlayingData {
  is_playing: boolean;
  item: {
    name: string;
    album: {
      name: string;
      artists: Array<{ name: string }>;
      images: [{ url: string }];
    };
    external_urls: {
      spotify: string;
    };
  };
  currently_playing_type: string;
}

type PlaylistCreationData = {
  data: SpotifyData[];
};

const getAccessToken = async () => {
  const res = await axios.post<{ access_token: string }>(
    TOKEN_ENDPOINT,
    querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token,
    }),
    {
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return res.data.access_token;
};

const getNowPlaying = async () => {
  const access_token = await getAccessToken();

  return axios.get<SpotifyPlayingData>(NOW_PLAYING_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
};

const createPlaylist = async (name: string) => {
  const access_token = await getAccessToken();

  const playlist = await axios.post(CREATE_PLAYLIST_ENDPOINT, {
    name,
    description: "Generated with Squad Spotify Wrapped: spotify.kasralekan.com",
    public: true,
    collaborative: false
  }, {
    headers: { 
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });

  return playlist;
};

const addTracksToPlaylist = async (playlistId: string, trackUris: string[]) => {
  const access_token = await getAccessToken();

  return axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    uris: trackUris
  }, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });
};

const searchTrack = async (query: string, isArtist = false) => {
  const access_token = await getAccessToken();

  type SpotifySearchResponse = {
    artists?: {
      items: Array<{
        id: string;
      }>;
    };
    tracks?: {
      items: Array<unknown>;
    };
  };

  const searchParams = {
    q: isArtist ? `artist:${query}` : query,
    type: isArtist ? 'artist' : 'track',
    limit: 20
  };

  const response = await axios.get<SpotifySearchResponse>(SEARCH_ENDPOINT, {
    params: searchParams,
    headers: { 
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (isArtist && response.data.artists?.items?.length > 0) {
    const artistId = response.data.artists?.items[0]?.id;
    const topTracksResponse = await axios.get<{tracks: Array<unknown>}>(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return topTracksResponse.data.tracks.slice(0, 5);
  }

  return response.data.tracks?.items ?? [];
};

export async function GET() {
  const response = await getNowPlaying();

  console.log(response);

  if (
    response.status === 204 ||
    response.status > 400 ||
    response.data.currently_playing_type !== 'track'
  ) {
    return new NextResponse(
      JSON.stringify({ isPlaying: false }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=90'
        },
      }
    );
  }

  const data = {
    isPlaying: response.data.is_playing,
    title: response.data.item.name,
    album: response.data.item.album.name,
    artist: response.data.item.album.artists
      .map((artist) => artist.name)
      .join(', '),
    albumImageUrl: response.data.item.album.images[0].url,
    songUrl: response.data.item.external_urls.spotify,
  };

  return new NextResponse(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=90'
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body: PlaylistCreationData = await request.json();
    
    if (!body.data || body.data.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'No input data provided' }),
        { status: 400 }
      );
    }

    // Create new playlist
    const playlist = await createPlaylist('Squad Spotify Wrapped Playlist');
    const playlistId = playlist.data.id;
    const addedTrackUris = new Set<string>();

    // Process songs
    for (const userData of body.data) {
      for (const song of userData["Top Songs"]) {
        const searchResults = await searchTrack(song);
        if (searchResults.length > 0) {
          const track = searchResults[0] as { uri: string };
          if (!addedTrackUris.has(track.uri)) {
            await addTracksToPlaylist(playlistId, [track.uri]);
            addedTrackUris.add(track.uri);
          }
        }
      }
    }

    // Process artists
    for (const userData of body.data) {
      for (const artist of userData["Top Artists"]) {
        const artistTracks = await searchTrack(artist, true);
        let addedCount = 0;
        
        for (let i = 0; i < artistTracks.length && addedCount < 3; i++) {
          const track = artistTracks[i] as { uri: string };
          if (!addedTrackUris.has(track.uri)) {
            await addTracksToPlaylist(playlistId, [track.uri]);
            addedTrackUris.add(track.uri);
            addedCount++;
          }
        }
      }
    }

    return new NextResponse(
      JSON.stringify({ playlistId }),
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error creating playlist:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to create playlist' }),
      { status: 500 }
    );
  }
}