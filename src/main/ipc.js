const { ipcMain } = require('electron');
const { getDb } = require('./db');
const { hashPassword, verifyPassword, createSalt, deriveKey } = require('./services/crypto');
const { setUserKey, getUserKey, clearUserKey } = require('./services/sessions');
const vault = require('./services/vault');
const { openCmdAt } = require('./services/os');

function registerIpcHandlers() {
    ipcMain.handle('profiles:list', () => {
        const db = getDb();
        return db.prepare('SELECT id, username, profile_image AS profileImage FROM users ORDER BY username').all();
    });

    ipcMain.handle('profiles:create', (_event, payload) => {
        const username = String(payload?.username || '').trim();
        const password = String(payload?.password || '');

        if (!username || !password) {
            return { ok: false, message: 'Username and password are required.' };
        }

        const db = getDb();
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return { ok: false, message: 'That username already exists.' };
        }

        const passwordHash = hashPassword(password);
        const keySalt = createSalt();
        const result = db
            .prepare('INSERT INTO users (username, password_hash, key_salt, created_at) VALUES (?, ?, ?, ?)')
            .run(username, passwordHash, keySalt, new Date().toISOString());

        vault.ensureUserRoot(result.lastInsertRowid);

        return {
            ok: true,
            user: {
                id: result.lastInsertRowid,
                username,
                profileImage: null,
            },
        };
    });

    ipcMain.handle('profiles:open', (_event, payload) => {
        const username = String(payload?.username || '').trim();
        const password = String(payload?.password || '');

        const db = getDb();
        const user = db
            .prepare(
                'SELECT id, username, password_hash AS passwordHash, key_salt AS keySalt, profile_image AS profileImage FROM users WHERE username = ?'
            )
            .get(username);

        if (!user) {
            return { ok: false, message: 'Profile not found.' };
        }

        const matches = verifyPassword(password, user.passwordHash);
        if (!matches) {
            return { ok: false, message: 'Incorrect password.' };
        }

        const keySalt = user.keySalt || createSalt();
        if (!user.keySalt) {
            db.prepare('UPDATE users SET key_salt = ? WHERE id = ?').run(keySalt, user.id);
        }

        const key = deriveKey(password, keySalt);
        setUserKey(user.id, key);

        return {
            ok: true,
            user: {
                id: user.id,
                username: user.username,
                profileImage: user.profileImage,
            },
        };
    });

    ipcMain.handle('profiles:update', (_event, payload) => {
        const userId = Number(payload?.userId);
        const username = String(payload?.username || '').trim();
        const password = String(payload?.password || '');

        if (!userId || !username) {
            return { ok: false, message: 'Profile data is incomplete.' };
        }

        const db = getDb();
        const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
        if (existing) {
            return { ok: false, message: 'That username is already taken.' };
        }

        if (password) {
            const existingKey = getUserKey(userId);
            if (!existingKey) {
                return { ok: false, message: 'Session expired. Unlock the vault again.' };
            }

            const newSalt = createSalt();
            const newKey = deriveKey(password, newSalt);
            const rotateResult = vault.rotateUserKey(userId, existingKey, newKey);
            if (!rotateResult.ok) {
                return rotateResult;
            }

            const passwordHash = hashPassword(password);
            db.prepare('UPDATE users SET username = ?, password_hash = ?, key_salt = ? WHERE id = ?').run(
                username,
                passwordHash,
                newSalt,
                userId
            );
            setUserKey(userId, newKey);
        } else {
            db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
        }

        return { ok: true };
    });

    ipcMain.handle('entries:list', (_event, payload) => {
        return vault.listEntries(Number(payload?.userId), payload?.path || '');
    });

    ipcMain.handle('entries:createFolder', (_event, payload) => {
        return vault.createFolder(Number(payload?.userId), payload?.path || '', String(payload?.name || ''));
    });

    ipcMain.handle('entries:delete', (_event, payload) => {
        return vault.deleteEntry(Number(payload?.userId), payload?.path || '');
    });

    ipcMain.handle('entries:rename', (_event, payload) => {
        return vault.renameEntry(Number(payload?.userId), payload?.path || '', String(payload?.name || ''));
    });

    ipcMain.handle('entries:toggleLock', (_event, payload) => {
        return vault.toggleLock({
            userId: Number(payload?.userId),
            path: payload?.path || '',
            entryType: payload?.entryType || 'file',
            locked: Boolean(payload?.locked),
            password: payload?.password || '',
        });
    });

    ipcMain.handle('entries:open', (_event, payload) => {
        return vault.openEntry(Number(payload?.userId), payload?.path || '', payload?.password || '');
    });

    ipcMain.handle('entries:importFiles', (_event, payload) => {
        return vault.importFiles(Number(payload?.userId), payload?.path || '', payload?.files || []);
    });

    ipcMain.handle('entries:preview', (_event, payload) => {
        return vault.previewEntry(Number(payload?.userId), payload?.path || '', payload?.password || '');
    });

    ipcMain.handle('entries:search', (_event, payload) => {
        return vault.searchEntries(Number(payload?.userId), String(payload?.query || ''), payload?.path || '');
    });

    ipcMain.handle('activity:list', (_event, payload) => {
        return vault.listActivity(Number(payload?.userId), Number(payload?.limit || 20));
    });

    ipcMain.handle('session:lock', (_event, payload) => {
        clearUserKey(Number(payload?.userId));
        return { ok: true };
    });

    ipcMain.handle('system:openCmd', (_event, payload) => {
        const resolved = vault.resolveEntryPath(Number(payload?.userId), payload?.path || '');
        openCmdAt(resolved.fullPath);
        return { ok: true };
    });
}

module.exports = { registerIpcHandlers };
