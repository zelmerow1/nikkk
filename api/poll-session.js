import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({ error: 'Brak sessionId' });
        }

        const data = await redis.get(`session:${sessionId}`);
        
        if (!data) {
            return res.status(404).json({ error: 'Sesja nie istnieje lub wygasła' });
        }

        const session = JSON.parse(data);
        
        return res.status(200).json({
            code: session.code || null,
            verified: session.verified || false,
            rejected: session.rejected || false,
            approved: session.approved || false
        });

    } catch (error) {
        console.error('Poll error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
