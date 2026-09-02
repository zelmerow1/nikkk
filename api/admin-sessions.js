// api/admin-sessions.js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { adminPassword } = req.query;

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Nieprawidłowe hasło admina' });
    }

    const sessionIds = await redis.smembers('sessions');
    const sessions = [];

    for (const id of sessionIds) {
        const data = await redis.get(`session:${id}`);
        if (data) {
            const session = JSON.parse(data);
            sessions.push({
                sessionId: id,
                email: session.email,
                timestamp: session.timestamp,
                hasCode: !!session.code,
                verified: session.verified || false,
                rejected: session.rejected || false,
                approved: session.approved || false
            });
        }
    }

    // Sortuj od najnowszych
    sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json({ sessions });
}
