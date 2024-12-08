import { config } from '@/config/env';

export async function POST() {
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(
                    `${config.spotify.clientId}:${config.spotify.clientSecret}`
                ).toString('base64'),
            },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'scope': 'playlist-modify-public playlist-modify-private'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Spotify token error:', errorData);
            throw new Error('Failed to get Spotify token');
        }

        const data = await response.json() as { access_token: string };
        if (!data.access_token) {
            throw new Error('Invalid token response from Spotify');
        }

        return Response.json({ access_token: data.access_token });
    } catch (error) {
        console.error('Token generation error:', error);
        return Response.json(
            { error: 'Failed to generate token' }, 
            { status: 500 }
        );
    }
} 