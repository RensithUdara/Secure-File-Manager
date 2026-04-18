const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, shell } = require('electron');
const { getDb } = require('../db');
const { normalizeRelPath, resolveUserPath, toPosixPath } = require('../utils/paths');
const { hashPassword, verifyPassword, encryptBuffer, decryptBuffer } = require('./crypto');
const { getUserKey } = require('./sessions');

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
const MAX_SEARCH_RESULTS = 250;

function getStorageRoot() {
    return path.join(app.getPath('userData'), 'storage');
}

function getTempRoot() {
    return path.join(app.getPath('userData'), 'tmp');
}

function ensureUserRoot(userId) {
    const root = path.join(getStorageRoot(), `user_${userId}`);
    fs.mkdirSync(root, { recursive: true });
    return root;
}

function resolveEntryPath(userId, relPath = '') {
    const root = ensureUserRoot(userId);
    return resolveUserPath(root, relPath);
}

function requireUserKey(userId) {
    return getUserKey(userId);
}

function getLocksMap(userId) {
    const db = getDb();
    const rows = db
        .prepare('SELECT entry_path AS entryPath, entry_type AS entryType, password_hash AS passwordHash FROM locks WHERE user_id = ?')
        .all(userId);

    const map = new Map();
    rows.forEach((row) => {
        map.set(row.entryPath, {
            entryType: row.entryType,
            passwordHash: row.passwordHash,
            hasPassword: Boolean(row.passwordHash),
        });
    });

    return map;
}

function resolveLockForPath(lockMap, relPath) {
    if (!relPath) return null;
    const parts = relPath.split('/').filter(Boolean);
    for (let i = parts.length; i >= 1; i -= 1) {
        const key = parts.slice(0, i).join('/');
        if (lockMap.has(key)) {
            return { path: key, ...lockMap.get(key) };
        }
    }
    return null;
}

function logActivity(userId, action, entryPath, meta) {
    const db = getDb();
    db.prepare('INSERT INTO activity (user_id, action, entry_path, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(
        userId,
        action,
        entryPath || null,
        meta ? JSON.stringify(meta) : null,
        new Date().toISOString()
    );
}

function listEntries(userId, relPath = '') {
    const root = ensureUserRoot(userId);
    const { fullPath, relPath: safeRel } = resolveUserPath(root, relPath);

    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }

    const lockMap = getLocksMap(userId);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    return entries.map((entry) => {
        const entryRel = normalizeRelPath(path.posix.join(toPosixPath(safeRel), entry.name));
        const lock = resolveLockForPath(lockMap, entryRel);

        return {
            name: entry.name,
            type: entry.isDirectory() ? 'folder' : 'file',
            relPath: entryRel,
            isLocked: Boolean(lock),
            hasPassword: Boolean(lock?.hasPassword),
        };
    });
}

function createFolder(userId, relPath, name) {
    const safeName = String(name).trim();
    if (!safeName) {
        return { ok: false, message: 'Folder name is required.' };
    }

    const root = ensureUserRoot(userId);
    const targetRel = normalizeRelPath(path.posix.join(toPosixPath(relPath), safeName));
    const { fullPath } = resolveUserPath(root, targetRel);
    fs.mkdirSync(fullPath, { recursive: true });

    logActivity(userId, 'create-folder', targetRel, { name: safeName });
    return { ok: true };
}

function deleteEntry(userId, relPath) {
    const { fullPath, relPath: safeRel } = resolveEntryPath(userId, relPath);
    fs.rmSync(fullPath, { recursive: true, force: true });

    const db = getDb();
    const prefix = safeRel ? `${safeRel}/` : '';
    db.prepare('DELETE FROM locks WHERE user_id = ? AND (entry_path = ? OR entry_path LIKE ?)')
        .run(userId, safeRel, `${prefix}%`);

    logActivity(userId, 'delete', safeRel);
    return { ok: true };
}

function renameEntry(userId, relPath, newName) {
    const safeName = String(newName).trim();
    if (!safeName) {
        return { ok: false, message: 'New name is required.' };
    }

    const { fullPath, relPath: safeRel } = resolveEntryPath(userId, relPath);
    const parentRel = safeRel.split('/').slice(0, -1).join('/');
    const targetRel = normalizeRelPath(path.posix.join(parentRel, safeName));
    const { fullPath: targetPath } = resolveEntryPath(userId, targetRel);

    fs.renameSync(fullPath, targetPath);

    const db = getDb();
    const rows = db
        .prepare('SELECT id, entry_path AS entryPath FROM locks WHERE user_id = ? AND (entry_path = ? OR entry_path LIKE ?)')
        .all(userId, safeRel, `${safeRel}/%`);

    rows.forEach((row) => {
        const updatedPath = row.entryPath.replace(safeRel, targetRel);
        db.prepare('UPDATE locks SET entry_path = ? WHERE id = ?').run(updatedPath, row.id);
    });

    logActivity(userId, 'rename', targetRel, { from: safeRel });
    return { ok: true };
}

function toggleLock({ userId, path: relPath, entryType, locked, password }) {
    const { relPath: safeRel } = resolveEntryPath(userId, relPath);
    const db = getDb();

    if (!locked) {
        const existing = db
            .prepare('SELECT password_hash AS passwordHash FROM locks WHERE user_id = ? AND entry_path = ?')
            .get(userId, safeRel);
        if (existing?.passwordHash) {
            const matches = verifyPassword(password || '', existing.passwordHash);
            if (!matches) {
                return { ok: false, message: 'Incorrect lock password.' };
            }
        }

        db.prepare('DELETE FROM locks WHERE user_id = ? AND entry_path = ?').run(userId, safeRel);
        logActivity(userId, 'unlock', safeRel);
        return { ok: true };
    }

    const passwordHash = password ? hashPassword(password) : null;
    db.prepare(
        `INSERT INTO locks (user_id, entry_path, entry_type, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, entry_path) DO UPDATE SET password_hash = excluded.password_hash, entry_type = excluded.entry_type`
    ).run(userId, safeRel, entryType, passwordHash, new Date().toISOString());

    logActivity(userId, 'lock', safeRel, { hasPassword: Boolean(passwordHash) });
    return { ok: true };
}

function ensureUnlock(userId, relPath, password) {
    const lockMap = getLocksMap(userId);
    const lock = resolveLockForPath(lockMap, relPath);
    if (!lock) return { ok: true };
    if (!lock.passwordHash) return { ok: true };

    const matches = verifyPassword(password || '', lock.passwordHash);
    if (!matches) {
        return { ok: false, message: 'Incorrect lock password.' };
    }

    return { ok: true };
}

function getUniqueName(rootPath, name) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    let attempt = 0;
    let candidate = name;

    while (fs.existsSync(path.join(rootPath, candidate))) {
        attempt += 1;
        candidate = `${base} (${attempt})${ext}`;
    }

    return candidate;
}

function importFiles(userId, relPath, files) {
    const key = requireUserKey(userId);
    if (!key) {
        return { ok: false, message: 'Session expired. Unlock the vault again.' };
    }

    const root = ensureUserRoot(userId);
    const { fullPath } = resolveUserPath(root, relPath);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }

    const imported = [];
    const skipped = [];

    files.forEach((file) => {
        const name = String(file?.name || '').trim();
        if (!name || !file?.data) {
            skipped.push({ name, reason: 'Invalid file' });
            return;
        }

        const dataBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        if (dataBuffer.byteLength > MAX_IMPORT_BYTES) {
            skipped.push({ name, reason: 'File too large' });
            return;
        }

        const safeName = getUniqueName(fullPath, path.basename(name));
        const targetRel = normalizeRelPath(path.posix.join(toPosixPath(relPath), safeName));
        const { fullPath: targetPath } = resolveUserPath(root, targetRel);
        const encrypted = encryptBuffer(dataBuffer, key);
        fs.writeFileSync(targetPath, encrypted);
        imported.push({ name: safeName, path: targetRel });
        logActivity(userId, 'import', targetRel, { size: dataBuffer.byteLength });
    });

    return { ok: true, imported, skipped };
}

function openEntry(userId, relPath, password) {
    const key = requireUserKey(userId);
    if (!key) {
        return { ok: false, message: 'Session expired. Unlock the vault again.' };
    }

    const { fullPath, relPath: safeRel } = resolveEntryPath(userId, relPath);
    if (!fs.existsSync(fullPath)) {
        return { ok: false, message: 'Entry not found.' };
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
        return { ok: false, message: 'Cannot open a folder directly.' };
    }

    const lockCheck = ensureUnlock(userId, safeRel, password);
    if (!lockCheck.ok) return lockCheck;

    const encrypted = fs.readFileSync(fullPath);
    let decrypted;
    try {
        decrypted = decryptBuffer(encrypted, key);
    } catch (error) {
        return { ok: false, message: 'Unable to decrypt file.' };
    }

    const tempRoot = getTempRoot();
    fs.mkdirSync(tempRoot, { recursive: true });
    const tempName = `${Date.now()}-${crypto.randomUUID()}-${path.basename(fullPath)}`;
    const tempPath = path.join(tempRoot, tempName);
    fs.writeFileSync(tempPath, decrypted);
    logActivity(userId, 'open', safeRel);
    return shell.openPath(tempPath).then((error) => {
        if (error) {
            return { ok: false, message: error };
        }
        logActivity(userId, 'open', safeRel);
        return { ok: true };
    });
}

function getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.pdf') return 'application/pdf';
    if (['.txt', '.md', '.log', '.json'].includes(ext)) return 'text/plain';
    return 'application/octet-stream';
}

function previewEntry(userId, relPath, password) {
    const key = requireUserKey(userId);
    if (!key) {
        return { ok: false, message: 'Session expired. Unlock the vault again.' };
    }

    const { fullPath, relPath: safeRel } = resolveEntryPath(userId, relPath);
    if (!fs.existsSync(fullPath)) {
        return { ok: false, message: 'Entry not found.' };
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
        return { ok: false, message: 'Preview only supports files.' };
    }

    if (stats.size > MAX_PREVIEW_BYTES) {
        return { ok: false, message: 'Preview is too large.' };
    }

    const lockCheck = ensureUnlock(userId, safeRel, password);
    if (!lockCheck.ok) return lockCheck;

    const encrypted = fs.readFileSync(fullPath);
    let decrypted;
    try {
        decrypted = decryptBuffer(encrypted, key);
    } catch (error) {
        return { ok: false, message: 'Unable to decrypt file.' };
    }

    const mime = getMimeType(fullPath);
    if (mime.startsWith('image/')) {
        return { ok: true, type: 'image', mime, data: decrypted.toString('base64') };
    }

    if (mime === 'application/pdf') {
        return { ok: true, type: 'pdf', mime, data: decrypted.toString('base64') };
    }

    const text = decrypted.toString('utf8');
    return { ok: true, type: 'text', mime, data: text.slice(0, 8000) };
}

function searchEntries(userId, query, relPath = '') {
    const root = ensureUserRoot(userId);
    const { fullPath, relPath: safeRel } = resolveUserPath(root, relPath);
    const term = String(query || '').trim().toLowerCase();
    if (!term) return [];
    if (!fs.existsSync(fullPath)) return [];

    const results = [];
    const lockMap = getLocksMap(userId);

    function walk(currentPath, currentRel) {
        if (results.length >= MAX_SEARCH_RESULTS) return;
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        entries.forEach((entry) => {
            if (results.length >= MAX_SEARCH_RESULTS) return;
            const entryRel = normalizeRelPath(path.posix.join(currentRel, entry.name));
            const match = entry.name.toLowerCase().includes(term);
            if (match) {
                const lock = resolveLockForPath(lockMap, entryRel);
                results.push({
                    name: entry.name,
                    type: entry.isDirectory() ? 'folder' : 'file',
                    relPath: entryRel,
                    isLocked: Boolean(lock),
                    hasPassword: Boolean(lock?.hasPassword),
                });
            }
            if (entry.isDirectory()) {
                walk(path.join(currentPath, entry.name), entryRel);
            }
        });
    }

    walk(fullPath, safeRel);
    return results;
}

function listActivity(userId, limit = 20) {
    const db = getDb();
    return db
        .prepare('SELECT action, entry_path AS entryPath, meta, created_at AS createdAt FROM activity WHERE user_id = ? ORDER BY id DESC LIMIT ?')
        .all(userId, limit)
        .map((row) => ({
            ...row,
            meta: row.meta ? JSON.parse(row.meta) : null,
        }));
}

function rotateUserKey(userId, oldKey, newKey) {
    const root = ensureUserRoot(userId);
    const failures = [];

    function walk(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        entries.forEach((entry) => {
            const entryPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                walk(entryPath);
                return;
            }

            try {
                const encrypted = fs.readFileSync(entryPath);
                const decrypted = decryptBuffer(encrypted, oldKey);
                const reEncrypted = encryptBuffer(decrypted, newKey);
                fs.writeFileSync(entryPath, reEncrypted);
            } catch (error) {
                failures.push(entryPath);
            }
        });
    }

    walk(root);
    if (failures.length) {
        return { ok: false, message: 'Failed to rotate encryption keys.', failures };
    }

    return { ok: true };
}

module.exports = {
    ensureUserRoot,
    resolveEntryPath,
    listEntries,
    createFolder,
    deleteEntry,
    renameEntry,
    toggleLock,
    openEntry,
    importFiles,
    previewEntry,
    searchEntries,
    listActivity,
    rotateUserKey,
};
