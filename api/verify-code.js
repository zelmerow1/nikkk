// api/verify-code.js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, code } = req.body;

    if (!sessionId || !code) {
        return res.status(400).json({ error: 'Brak sessionId lub kodu' });
    }

    const data = await redis.get(`session:${sessionId}`);
    if (!data) {
        return res.status(404).json({ error: 'Sesja nie istnieje' });
    }

    const session = JSON.parse(data);

    if (session.code === code) {
        session.verified = true;
        await redis.setex(`session:${sessionId}`, 300, JSON.stringify(session));

        await fetch(process.env.DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'MEGA Panel',
                embeds: [{
                    title: '✅ Użytkownik zweryfikował kod!',
                    description: `Użytkownik ${session.email} poprawnie wpisał kod.`,
                    color: 0x4ADE80
                }]
            })
        });

        return res.status(200).json({ 
            success: true, 
            message: 'Kod zweryfikowany!',
            verified: true
        });
    }

    return res.status(400).json({ 
        success: false, 
        message: 'Nieprawidłowy kod',
        verified: false
    });
}
