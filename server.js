const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');

const app = express();
const server = http.createServer(app);

const PORT = 3000;

// Hardcoded Admin Credentials for simplicity (Or from Environment Variables)
// Forced update to trigger Vercel rebuild
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const AUTH_TOKEN = 'secret-admin-token-tvku';

// Firebase Realtime Database URL
const FIREBASE_ROOT_URL = 'https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/.json';

const getFirebaseUrl = (serverName) => {
    if (!serverName || serverName === 'channels') {
        return 'https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/channels.json';
    }
    return `https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/${encodeURIComponent(serverName)}/channels.json`;
};

const getFirebaseItemUrl = (serverName, id) => {
    if (!serverName || serverName === 'channels') {
        return `https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/channels/${id}.json`;
    }
    return `https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/${encodeURIComponent(serverName)}/channels/${id}.json`;
};

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const FIREBASE_BASE = 'https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/';

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.json({ success: true, token: AUTH_TOKEN });
    } else {
        res.status(401).json({ success: false, error: 'Username atau Password salah!' });
    }
});

// Middleware to check auth token for protected routes
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${AUTH_TOKEN}`) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Please login.' });
    }
};

// GET all servers
app.get('/api/servers', requireAuth, async (req, res) => {
    try {
        const response = await fetch(FIREBASE_ROOT_URL + '?shallow=true');
        const data = await response.json();
        
        const reservedKeys = ['chat', 'settings', 'chat_effects', 'tv_admins'];
        const servers = [];
        if (data && !data.error) {
            for (const key in data) {
                if (!reservedKeys.includes(key)) {
                    servers.push(key);
                }
            }
        }
        res.json({ servers });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch servers" });
    }
});

// GET all channels
app.get('/api/channels', requireAuth, async (req, res) => {
    try {
        const serverName = req.query.server || 'channels';
        const response = await fetch(getFirebaseUrl(serverName));
        const data = await response.json();
        
        const channels = [];
        if (data && !data.error) {
            for (const key in data) {
                channels.push({ id: key, ...data[key] });
            }
        }
        res.json(channels);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch channels" });
    }
});

// POST new channel
app.post('/api/channels', requireAuth, async (req, res) => {
    try {
        const { name, category, logoUrl, streamUrl, drmType, drmKey, userAgent, referer, serverName } = req.body;
        const response = await fetch(getFirebaseUrl(serverName), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, logoUrl, streamUrl, drmType: drmType || '', drmKey: drmKey || '', userAgent: userAgent || '', referer: referer || '' })
        });
        const data = await response.json(); 
        res.json({ success: true, id: data.name });
    } catch (e) {
        res.status(500).json({ error: "Failed to add channel" });
    }
});

// GET settings
app.get('/api/settings', requireAuth, async (req, res) => {
    try {
        const response = await fetch('https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/settings.json');
        const data = await response.json();
        res.json(data || { backgrounds: [] });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// POST settings
app.post('/api/settings', requireAuth, async (req, res) => {
    try {
        const { backgrounds, m3u_url } = req.body;
        const response = await fetch('https://tvku-48c77-default-rtdb.asia-southeast1.firebasedatabase.app/settings.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backgrounds: backgrounds || [], m3u_url: m3u_url || '' })
        });
        const data = await response.json();
        res.json({ success: true, settings: data });
    } catch (e) {
        res.status(500).json({ error: "Failed to save settings" });
    }
});

// POST import m3u
app.post('/api/import', requireAuth, async (req, res) => {
    try {
        const { m3uUrl, serverName } = req.body;
        if (!m3uUrl) return res.status(400).json({ error: "M3U URL is required" });

        const response = await fetch(m3uUrl);
        const text = await response.text();

        const lines = text.split('\n');
        let currentChannel = { drmType: '', drmKey: '', userAgent: '', referer: '' };
        let importedCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXTINF:')) {
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                const logoUrl = logoMatch ? logoMatch[1] : '';

                const groupMatch = line.match(/group-title="([^"]+)"/);
                let category = groupMatch ? groupMatch[1] : 'Uncategorized';

                const commaIndex = line.lastIndexOf(',');
                const name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Unknown';

                currentChannel.name = name;
                currentChannel.category = category;
                currentChannel.logoUrl = logoUrl;
            } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_type=')) {
                currentChannel.drmType = line.split('=')[1].trim();
            } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                currentChannel.drmKey = line.split('=')[1].trim();
            } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
                currentChannel.userAgent = line.substring('#EXTVLCOPT:http-user-agent='.length).trim();
            } else if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
                currentChannel.referer = line.substring('#EXTVLCOPT:http-referrer='.length).trim();
            } else if (line !== '' && !line.startsWith('#')) {
                currentChannel.streamUrl = line;

                await fetch(getFirebaseUrl(serverName), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentChannel)
                });
                importedCount++;
                currentChannel = { drmType: '', drmKey: '', userAgent: '', referer: '' };
            }
        }

        res.json({ success: true, count: importedCount });
    } catch (e) {
        res.status(500).json({ error: "Failed to import M3U" });
    }
});

// PUT update channel
app.put('/api/channels/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, logoUrl, streamUrl, drmType, drmKey, userAgent, referer, serverName } = req.body;
        await fetch(getFirebaseItemUrl(serverName, id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, logoUrl, streamUrl, drmType: drmType || '', drmKey: drmKey || '', userAgent: userAgent || '', referer: referer || '' })
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to update channel" });
    }
});

// --- CHAT EFFECTS API ---
// Get Chat Effects
app.get('/api/chat-effects', requireAuth, async (req, res) => {
    try {
        const response = await fetch(`${FIREBASE_BASE}chat_effects.json`);
        const data = await response.json();
        
        // Ensure data is valid object. If data has error property, it means Firebase returned an error
        if (data && data.error) {
            throw new Error(data.error);
        }
        res.json(data || {});
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil efek chat.' });
    }
});

// Add/Update Chat Effect
app.post('/api/chat-effects', requireAuth, async (req, res) => {
    try {
        const { username, badgeUrl, textColor, bgGifUrl } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Username wajib diisi' });
        }
        
        const safeKey = encodeURIComponent(username);
        
        await fetch(`${FIREBASE_BASE}chat_effects/${safeKey}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                badgeUrl: badgeUrl || "",
                textColor: textColor || "",
                bgGifUrl: bgGifUrl || ""
            })
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menyimpan efek chat.' });
    }
});

// Delete Chat Effect
app.delete('/api/chat-effects/:username', requireAuth, async (req, res) => {
    try {
        const safeKey = encodeURIComponent(req.params.username);
        await fetch(`${FIREBASE_BASE}chat_effects/${safeKey}.json`, {
            method: 'DELETE'
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menghapus efek chat.' });
    }
});

// --- TV APP ADMINS API ---
// Get TV Admins
app.get('/api/tv-admins', requireAuth, async (req, res) => {
    try {
        const response = await fetch(`${FIREBASE_BASE}tv_admins.json`);
        const data = await response.json();
        
        if (data && data.error) {
            throw new Error(data.error);
        }
        res.json(data || {});
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil data admin TV.' });
    }
});

// Add/Update TV Admin
app.post('/api/tv-admins', requireAuth, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan Password wajib diisi' });
        }
        
        const safeKey = encodeURIComponent(username);
        
        await fetch(`${FIREBASE_BASE}tv_admins/${safeKey}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menyimpan admin TV.' });
    }
});

// Delete TV Admin
app.delete('/api/tv-admins/:username', requireAuth, async (req, res) => {
    try {
        const safeKey = encodeURIComponent(req.params.username);
        await fetch(`${FIREBASE_BASE}tv_admins/${safeKey}.json`, {
            method: 'DELETE'
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menghapus admin TV.' });
    }
});

// DELETE single channel
app.delete('/api/channels/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const serverName = req.query.server || 'channels';
        await fetch(getFirebaseItemUrl(serverName, id), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete channel" });
    }
});

// DELETE all channels
app.delete('/api/channels', requireAuth, async (req, res) => {
    try {
        const serverName = req.query.server || 'channels';
        await fetch(getFirebaseUrl(serverName), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete all channels" });
    }
});

// WebSockets have been removed in favor of Firebase Realtime Database for Live Chat

// Vercel Serverless Export
module.exports = app;

// Listen only if not in production (Vercel uses module.exports)
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`Admin Panel & API is running locally on http://localhost:${PORT}`);
    });
}
