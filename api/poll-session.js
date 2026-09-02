// api/poll-session.js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ error: 'Brak sessionId' });
    }

    const data = await redis.get(`session:${sessionId}`);
    
    if (!data) {
        return res.status(404).json({ error: 'Sesja nie istnieje' });
    }

    const session = JSON.parse(data);
    
    return res.status(200).json({
        code: session.code || null,
        verified: session.verified || false,
        rejected: session.rejected || false,
        approved: session.approved || false
    });
}
