import { type SpotifyApiService } from '@/services/spotifyApi';

interface ParsedMusicData {
    songs: string[];
    artists: string[];
}

export class PlaylistGenerator {
    private spotifyApi: SpotifyApiService;
    private addedTrackIds: Set<string>;

    constructor(spotifyApi: SpotifyApiService) {
        this.spotifyApi = spotifyApi;
        this.addedTrackIds = new Set();
    }

    async generatePlaylist(data: ParsedMusicData): Promise<string | null> {
        const trackUris: string[] = [];
        
        // Add top 5 songs
        for (const song of data.songs.slice(0, 5)) {
            const track = await this.spotifyApi.searchTrack(song);
            if (track && !this.addedTrackIds.has(track.id)) {
                trackUris.push(`spotify:track:${track.id}`);
                this.addedTrackIds.add(track.id);
            }
        }

        // Add top 2 songs from each artist
        for (const artistName of data.artists) {
            const artist = await this.spotifyApi.searchArtist(artistName);
            if (artist) {
                const topTracks = await this.spotifyApi.getArtistTopTracks(artist.id);
                let addedFromArtist = 0;
                
                for (const track of topTracks) {
                    if (addedFromArtist >= 2) break;
                    if (!this.addedTrackIds.has(track.id)) {
                        trackUris.push(`spotify:track:${track.id}`);
                        this.addedTrackIds.add(track.id);
                        addedFromArtist++;
                    }
                }
            }
        }

        if (trackUris.length === 0) {
            return null;
        }

        // Create playlist and add tracks
        const playlistId = await this.spotifyApi.createPlaylist(
            'Generated Music Playlist'
        );
        console.log(playlistId);

        if (playlistId) {
            const success = await this.spotifyApi.addTracksToPlaylist(playlistId, trackUris);
            return success ? playlistId : null;
        }

        return null;
    }
} 