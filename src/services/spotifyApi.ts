import ky from 'ky';

interface SpotifyCredentials {
    clientId: string;
    clientSecret: string;
}

interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
}

interface SpotifyArtist {
    id: string;
    name: string;
}

export class SpotifyApiService {
    private accessToken: string | null = null;
    private readonly credentials: SpotifyCredentials;
    private readonly baseUrl = 'https://api.spotify.com/v1';
    private readonly serviceUserId = '31gf34jpvvkomqsizyaofsqowgce';

    constructor(credentials: SpotifyCredentials) {
        this.credentials = credentials;
    }

    private async getAccessToken(): Promise<string> {
        if (this.accessToken) return this.accessToken;

        try {
            const response = await fetch('/api/spotify/token', {
                method: 'POST',
            });
            
            if (!response.ok) {
                throw new Error('Failed to get access token');
            }

            const data = await response.json() as { access_token: string };
            if (!data.access_token) {
                throw new Error('Invalid token response');
            }
            
            this.accessToken = data.access_token;
            return this.accessToken;
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    private async apiRequest<T>(endpoint: string, method = 'GET', data?: unknown): Promise<T> {
        const token = await this.getAccessToken();
        const response = await ky(this.baseUrl + endpoint, {
            method,
            json: data,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).json<T>();
        return response;
    }

    async searchTrack(query: string): Promise<SpotifyTrack | null> {
        try {
            interface SearchResponse {
                tracks: {
                    items: SpotifyTrack[];
                };
            }
            const response = await this.apiRequest<SearchResponse>(
                `/search?q=${encodeURIComponent(query)}&type=track&limit=1`
            );
            return response.tracks.items[0] ?? null;
        } catch (error) {
            console.error(`Error searching for track: ${query}`, error);
            return null;
        }
    }

    async getArtistTopTracks(artistId: string): Promise<SpotifyTrack[]> {
        try {
            interface TopTracksResponse {
                tracks: SpotifyTrack[];
            }
            const response = await this.apiRequest<TopTracksResponse>(
                `/artists/${artistId}/top-tracks?market=US`
            );
            return response.tracks || [];
        } catch (error) {
            console.error(`Error getting top tracks for artist: ${artistId}`, error);
            return [];
        }
    }

    async searchArtist(name: string): Promise<SpotifyArtist | null> {
        try {
            interface SearchResponse {
                artists: {
                    items: SpotifyArtist[];
                };
            }
            const response = await this.apiRequest<SearchResponse>(
                `/search?q=${encodeURIComponent(name)}&type=artist&limit=1`
            );
            return response.artists.items[0] ?? null;
        } catch (error) {
            console.error(`Error searching for artist: ${name}`, error);
            return null;
        }
    }

    async createPlaylist(name: string): Promise<string | null> {
        try {
            interface PlaylistResponse {
                id: string;
                external_urls: {
                    spotify: string;
                };
                collaborative: boolean; 
                public: boolean;
                tracks: {
                    total: number;
                };
            }
            
            const token = await this.getAccessToken();
            if (!token) {
                throw new Error('No access token available');
            }

            const response = await fetch(`https://api.spotify.com/v1/users/${this.serviceUserId}/playlists`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    description: 'Created from Squad Spotify Wrapped',
                    public: true,
                    collaborative: false
                })
            }).then(res => res.json()) as PlaylistResponse;
            
            return response.id;
        } catch (error) {
            console.error('Error creating playlist:', error);
            return null;
        }
    }

    async addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<boolean> {
        try {
            await this.apiRequest(
                `/playlists/${playlistId}/tracks`,
                'POST',
                {
                    uris: trackUris
                }
            );
            return true;
        } catch (error) {
            console.error('Error adding tracks to playlist', error);
            return false;
        }
    }
}