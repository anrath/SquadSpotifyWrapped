export const config = {
    // ... existing config
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID ?? '',
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? ''
    }
}; 