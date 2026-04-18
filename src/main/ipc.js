const { ipcMain } = require('electron');
const crypto = require('crypto');
const { getDb } = require('./db');
const { hashPassword, verifyPassword, createSalt, deriveKey } = require('./services/crypto');
const { setUserKey, getUserKey, clearUserKey } = require('./services/sessions');
const settings = require('./services/settings');
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

    ipcMain.handle('settings:get', () => {
        return settings.getSettingsSummary();
    });

    ipcMain.handle('settings:setTheme', (_event, payload) => {
        return settings.setTheme(String(payload?.theme || 'neon'));
    });

    ipcMain.handle('settings:setStartupPassword', (_event, payload) => {
        const password = String(payload?.password || '');
        if (!password) {
            return { ok: false, message: 'Password is required.' };
        }
        return settings.setStartupPassword(password);
    });

    ipcMain.handle('settings:clearStartupPassword', () => {
        return settings.clearStartupPassword();
    });

    ipcMain.handle('settings:unlockStartup', (_event, payload) => {
        return settings.verifyStartupPassword(String(payload?.password || ''));
    });

    ipcMain.handle('invites:create', (_event, payload) => {
        const username = String(payload?.username || '').trim();
        const password = String(payload?.password || '');
        const expiresInHours = Number(payload?.expiresInHours || 72);

        if (!username || !password) {
            return { ok: false, message: 'Profile and password are required.' };
        }

        const db = getDb();
        const user = db
            .prepare('SELECT id, password_hash AS passwordHash FROM users WHERE username = ?')
            .get(username);
        if (!user) {
            return { ok: false, message: 'Profile not found.' };
        }

        const matches = verifyPassword(password, user.passwordHash);
        if (!matches) {
            return { ok: false, message: 'Incorrect password.' };
        }

        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + expiresInHours * 60 * 60 * 1000);

        db.prepare('INSERT INTO invites (code, created_by, created_at, expires_at) VALUES (?, ?, ?, ?)')
            .run(code, user.id, createdAt.toISOString(), expiresAt.toISOString());

        return { ok: true, code, expiresAt: expiresAt.toISOString() };
    });

    ipcMain.handle('invites:redeem', (_event, payload) => {
        const code = String(payload?.code || '').trim().toUpperCase();
        const username = String(payload?.username || '').trim();
        const password = String(payload?.password || '');

        if (!code || !username || !password) {
            return { ok: false, message: 'Code, username, and password are required.' };
        }

        const db = getDb();
        const invite = db
            .prepare('SELECT id, expires_at AS expiresAt, redeemed_at AS redeemedAt FROM invites WHERE code = ?')
            .get(code);

        if (!invite) {
            return { ok: false, message: 'Invite code not found.' };
        }

        if (invite.redeemedAt) {
            return { ok: false, message: 'Invite code already redeemed.' };
        }

        if (new Date(invite.expiresAt) < new Date()) {
            return { ok: false, message: 'Invite code has expired.' };
        }

        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return { ok: false, message: 'That username already exists.' };
        }

        const passwordHash = hashPassword(password);
        const keySalt = createSalt();
        const result = db
            .prepare('INSERT INTO users (username, password_hash, key_salt, created_at) VALUES (?, ?, ?, ?)')
            .run(username, passwordHash, keySalt, new Date().toISOString());

        db.prepare('UPDATE invites SET redeemed_by = ?, redeemed_at = ? WHERE id = ?')
            .run(result.lastInsertRowid, new Date().toISOString(), invite.id);

        vault.ensureUserRoot(result.lastInsertRowid);
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

    ipcMain.handle('entries:recent', (_event, payload) => {
        return vault.listRecent(Number(payload?.userId), Number(payload?.limit || 30));
    });

    ipcMain.handle('entries:listTrash', (_event, payload) => {
        return vault.listTrash(Number(payload?.userId));
    });

    ipcMain.handle('entries:restoreTrash', (_event, payload) => {
        return vault.restoreTrash(Number(payload?.userId), Number(payload?.trashId));
    });

    ipcMain.handle('entries:purgeTrash', (_event, payload) => {
        return vault.purgeTrash(Number(payload?.userId), Number(payload?.trashId));
    });

    ipcMain.handle('entries:getMeta', (_event, payload) => {
        return vault.getEntryMeta(Number(payload?.userId), payload?.path || '');
    });

    ipcMain.handle('entries:setMeta', (_event, payload) => {
        return vault.setEntryMeta(Number(payload?.userId), payload?.path || '', payload?.tags || [], payload?.note || '');
    });

    ipcMain.handle('entries:createVersion', (_event, payload) => {
        return vault.createVersion(Number(payload?.userId), payload?.path || '');
    });

    ipcMain.handle('entries:listVersions', (_event, payload) => {
        return vault.listVersions(Number(payload?.userId), payload?.path || '');
    });

    ipcMain.handle('entries:restoreVersion', (_event, payload) => {
        return vault.restoreVersion(Number(payload?.userId), Number(payload?.versionId));
    });

    ipcMain.handle('favorites:toggle', (_event, payload) => {
        return vault.toggleFavorite(Number(payload?.userId), payload?.path || '');
    });

    ipcMain.handle('favorites:list', (_event, payload) => {
        return vault.listFavorites(Number(payload?.userId));
    });

    ipcMain.handle('activity:list', (_event, payload) => {
        return vault.listActivity(Number(payload?.userId), Number(payload?.limit || 20));
    });

    ipcMain.handle('activity:export', (_event, payload) => {
        return vault.exportActivityCsv(Number(payload?.userId));
    });

    ipcMain.handle('vault:exportArchive', (_event, payload) => {
        return vault.exportVaultArchive(Number(payload?.userId));
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
