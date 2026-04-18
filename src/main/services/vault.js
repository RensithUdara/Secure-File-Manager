const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const { app, shell, dialog } = require('electron');
const { getDb } = require('../db');
const { normalizeRelPath, resolveUserPath, toPosixPath } = require('../utils/paths');
const { hashPassword, verifyPassword, encryptBuffer, decryptBuffer } = require('./crypto');
const { getUserKey } = require('./sessions');

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
const MAX_SEARCH_RESULTS = 250;
const MAX_RECENT_RESULTS = 60;
const TRASH_DIR = '.trash';
const VERSIONS_DIR = '.versions';

function getStorageRoot() {
    return path.join(app.getPath('userData'), 'storage');
}

function getTempRoot() {
    return path.join(app.getPath('userData'), 'tmp');
}

function ensureDir(targetPath) {
    fs.mkdirSync(targetPath, { recursive: true });
}

function ensureUserRoot(userId) {
    const root = path.join(getStorageRoot(), `user_${userId}`);
    ensureDir(root);
    ensureDir(path.join(root, TRASH_DIR));
    ensureDir(path.join(root, VERSIONS_DIR));
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

function getFavoritesSet(userId) {
    const db = getDb();
    const rows = db.prepare('SELECT entry_path AS entryPath FROM favorites WHERE user_id = ?').all(userId);
    return new Set(rows.map((row) => row.entryPath));
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
        ensureDir(fullPath);
    }

    const lockMap = getLocksMap(userId);
    const favorites = getFavoritesSet(userId);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true })
        .filter((entry) => entry.name !== TRASH_DIR && entry.name !== VERSIONS_DIR);

    return entries.map((entry) => {
        const entryRel = normalizeRelPath(path.posix.join(toPosixPath(safeRel), entry.name));
        const lock = resolveLockForPath(lockMap, entryRel);

        return {
            name: entry.name,
            type: entry.isDirectory() ? 'folder' : 'file',
            relPath: entryRel,
            storagePath: entryRel,
            isLocked: Boolean(lock),
            hasPassword: Boolean(lock?.hasPassword),
            isFavorite: favorites.has(entryRel),
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
    ensureDir(fullPath);

    logActivity(userId, 'create-folder', targetRel, { name: safeName });
    return { ok: true };
}

function deleteEntry(userId, relPath) {
    const { fullPath, relPath: safeRel } = resolveEntryPath(userId, relPath);
    if (!fs.existsSync(fullPath)) {
        return { ok: false, message: 'Entry not found.' };
    }

    const root = ensureUserRoot(userId);
    const trashId = crypto.randomUUID();
    const trashedRel = normalizeRelPath(path.posix.join(TRASH_DIR, `${trashId}-${path.basename(safeRel)}`));
    const { fullPath: trashedPath } = resolveUserPath(root, trashedRel);

    fs.renameSync(fullPath, trashedPath);

    const db = getDb();
    const prefix = safeRel ? `${safeRel}/` : '';
    db.prepare('DELETE FROM locks WHERE user_id = ? AND (entry_path = ? OR entry_path LIKE ?)')
        .run(userId, safeRel, `${prefix}%`);
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND (entry_path = ? OR entry_path LIKE ?)')
        .run(userId, safeRel, `${prefix}%`);

    const entryType = fs.existsSync(trashedPath) && fs.statSync(trashedPath).isDirectory() ? 'folder' : 'file';
    db.prepare('INSERT INTO trash (user_id, original_path, trashed_path, entry_type, trashed_at) VALUES (?, ?, ?, ?, ?)')
        .run(userId, safeRel, trashedRel, entryType, new Date().toISOString());

    logActivity(userId, 'trash', safeRel, { trashId });
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

    db.prepare('UPDATE favorites SET entry_path = ? WHERE user_id = ? AND entry_path = ?')
        .run(targetRel, userId, safeRel);
    db.prepare('UPDATE entry_meta SET entry_path = ? WHERE user_id = ? AND entry_path = ?')
        .run(targetRel, userId, safeRel);
    db.prepare('UPDATE versions SET original_path = ? WHERE user_id = ? AND original_path = ?')
        .run(targetRel, userId, safeRel);

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
        ensureDir(fullPath);
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
    ensureDir(tempRoot);
    const tempName = `${Date.now()}-${crypto.randomUUID()}-${path.basename(fullPath)}`;
    const tempPath = path.join(tempRoot, tempName);
    fs.writeFileSync(tempPath, decrypted);
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
    const favorites = getFavoritesSet(userId);

    function walk(currentPath, currentRel) {
        if (results.length >= MAX_SEARCH_RESULTS) return;
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        entries.forEach((entry) => {
            if (results.length >= MAX_SEARCH_RESULTS) return;
            if (entry.name === TRASH_DIR || entry.name === VERSIONS_DIR) return;
            const entryRel = normalizeRelPath(path.posix.join(currentRel, entry.name));
            const match = entry.name.toLowerCase().includes(term);
            if (match) {
                const lock = resolveLockForPath(lockMap, entryRel);
                results.push({
                    name: entry.name,
                    type: entry.isDirectory() ? 'folder' : 'file',
                    relPath: entryRel,
                    storagePath: entryRel,
                    isLocked: Boolean(lock),
                    hasPassword: Boolean(lock?.hasPassword),
                    isFavorite: favorites.has(entryRel),
                    detail: entryRel,
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

function listRecent(userId, limit = MAX_RECENT_RESULTS) {
    const db = getDb();
    const rows = db
        .prepare(
            'SELECT entry_path AS entryPath, action, created_at AS createdAt FROM activity WHERE user_id = ? AND entry_path IS NOT NULL ORDER BY id DESC'
        )
        .all(userId);

    const seen = new Set();
    const results = [];
    const lockMap = getLocksMap(userId);
    const favorites = getFavoritesSet(userId);

    rows.forEach((row) => {
        if (results.length >= limit) return;
        if (seen.has(row.entryPath)) return;
        if (row.entryPath.startsWith(`${TRASH_DIR}/`) || row.entryPath.startsWith(`${VERSIONS_DIR}/`)) return;
        const { fullPath } = resolveEntryPath(userId, row.entryPath);
        if (!fs.existsSync(fullPath)) return;
        const stats = fs.statSync(fullPath);
        const lock = resolveLockForPath(lockMap, row.entryPath);
        seen.add(row.entryPath);
        results.push({
            name: path.basename(row.entryPath),
            type: stats.isDirectory() ? 'folder' : 'file',
            relPath: row.entryPath,
            storagePath: row.entryPath,
            isLocked: Boolean(lock),
            hasPassword: Boolean(lock?.hasPassword),
            isFavorite: favorites.has(row.entryPath),
            detail: row.entryPath,
        });
    });

    return results;
}

function listFavorites(userId) {
    const db = getDb();
    const rows = db
        .prepare('SELECT entry_path AS entryPath, created_at AS createdAt FROM favorites WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId);

    const results = [];
    const lockMap = getLocksMap(userId);
    rows.forEach((row) => {
        const { fullPath } = resolveEntryPath(userId, row.entryPath);
        if (!fs.existsSync(fullPath)) {
            db.prepare('DELETE FROM favorites WHERE user_id = ? AND entry_path = ?').run(userId, row.entryPath);
            return;
        }
        const stats = fs.statSync(fullPath);
        const lock = resolveLockForPath(lockMap, row.entryPath);
        results.push({
            name: path.basename(row.entryPath),
            type: stats.isDirectory() ? 'folder' : 'file',
            relPath: row.entryPath,
            storagePath: row.entryPath,
            isLocked: Boolean(lock),
            hasPassword: Boolean(lock?.hasPassword),
            isFavorite: true,
            detail: row.entryPath,
        });
    });

    return results;
}

function toggleFavorite(userId, relPath) {
    const safeRel = normalizeRelPath(relPath);
    const db = getDb();
    const existing = db.prepare('SELECT entry_path AS entryPath FROM favorites WHERE user_id = ? AND entry_path = ?')
        .get(userId, safeRel);
    if (existing) {
        db.prepare('DELETE FROM favorites WHERE user_id = ? AND entry_path = ?').run(userId, safeRel);
        return { ok: true, favorite: false };
    }
    db.prepare('INSERT INTO favorites (user_id, entry_path, created_at) VALUES (?, ?, ?)')
        .run(userId, safeRel, new Date().toISOString());
    return { ok: true, favorite: true };
}

function listTrash(userId) {
    const db = getDb();
    const rows = db
        .prepare('SELECT id, original_path AS originalPath, trashed_path AS trashedPath, entry_type AS entryType, trashed_at AS trashedAt FROM trash WHERE user_id = ? ORDER BY trashed_at DESC')
        .all(userId);

    const results = [];
    rows.forEach((row) => {
        const { fullPath } = resolveEntryPath(userId, row.trashedPath);
        if (!fs.existsSync(fullPath)) {
            db.prepare('DELETE FROM trash WHERE id = ?').run(row.id);
            return;
        }
        results.push({
            id: row.id,
            name: path.basename(row.originalPath),
            type: row.entryType,
            relPath: row.trashedPath,
            storagePath: row.trashedPath,
            originalPath: row.originalPath,
            isTrash: true,
            detail: row.originalPath,
        });
    });

    return results;
}

function restoreTrash(userId, trashId) {
    const db = getDb();
    const row = db
        .prepare('SELECT id, original_path AS originalPath, trashed_path AS trashedPath FROM trash WHERE user_id = ? AND id = ?')
        .get(userId, trashId);
    if (!row) {
        return { ok: false, message: 'Trash entry not found.' };
    }

    const { fullPath: trashedFull } = resolveEntryPath(userId, row.trashedPath);
    if (!fs.existsSync(trashedFull)) {
        db.prepare('DELETE FROM trash WHERE id = ?').run(trashId);
        return { ok: false, message: 'Trash entry missing.' };
    }

    const root = ensureUserRoot(userId);
    const parentRel = normalizeRelPath(path.posix.dirname(row.originalPath));
    const { fullPath: parentPath } = resolveUserPath(root, parentRel);
    ensureDir(parentPath);

    const targetName = getUniqueName(parentPath, path.basename(row.originalPath));
    const targetRel = normalizeRelPath(path.posix.join(parentRel, targetName));
    const { fullPath: targetFull } = resolveUserPath(root, targetRel);

    fs.renameSync(trashedFull, targetFull);
    db.prepare('DELETE FROM trash WHERE id = ?').run(trashId);

    logActivity(userId, 'restore', targetRel, { from: row.originalPath });
    return { ok: true, path: targetRel };
}

function purgeTrash(userId, trashId) {
    const db = getDb();
    const row = db
        .prepare('SELECT id, trashed_path AS trashedPath FROM trash WHERE user_id = ? AND id = ?')
        .get(userId, trashId);
    if (!row) {
        return { ok: false, message: 'Trash entry not found.' };
    }

    const { fullPath } = resolveEntryPath(userId, row.trashedPath);
    if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
    }
    db.prepare('DELETE FROM trash WHERE id = ?').run(trashId);
    logActivity(userId, 'purge', row.trashedPath);
    return { ok: true };
}

function getEntryMeta(userId, relPath) {
    const db = getDb();
    const row = db
        .prepare('SELECT tags_json AS tagsJson, note FROM entry_meta WHERE user_id = ? AND entry_path = ?')
        .get(userId, relPath);
    return {
        ok: true,
        tags: row?.tagsJson ? JSON.parse(row.tagsJson) : [],
        note: row?.note || '',
    };
}

function setEntryMeta(userId, relPath, tags, note) {
    const db = getDb();
    const tagsJson = JSON.stringify(tags || []);
    db.prepare(
        'INSERT INTO entry_meta (user_id, entry_path, tags_json, note, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, entry_path) DO UPDATE SET tags_json = excluded.tags_json, note = excluded.note, updated_at = excluded.updated_at'
    ).run(userId, relPath, tagsJson, note, new Date().toISOString());
    return { ok: true };
}

function createVersion(userId, relPath) {
    const { fullPath, relPath: safeRel } = resolveEntryPath(userId, relPath);
    if (!fs.existsSync(fullPath)) {
        return { ok: false, message: 'Entry not found.' };
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
        return { ok: false, message: 'Versions are for files only.' };
    }

    const root = ensureUserRoot(userId);
    const versionId = crypto.randomUUID();
    const versionRel = normalizeRelPath(path.posix.join(VERSIONS_DIR, `${versionId}-${path.basename(safeRel)}`));
    const { fullPath: versionFull } = resolveUserPath(root, versionRel);

    fs.copyFileSync(fullPath, versionFull);
    const db = getDb();
    db.prepare('INSERT INTO versions (user_id, original_path, version_path, created_at) VALUES (?, ?, ?, ?)')
        .run(userId, safeRel, versionRel, new Date().toISOString());

    logActivity(userId, 'version-create', safeRel, { versionId });
    return { ok: true };
}

function listVersions(userId, relPath) {
    const db = getDb();
    return db
        .prepare('SELECT id, created_at AS createdAt FROM versions WHERE user_id = ? AND original_path = ? ORDER BY id DESC')
        .all(userId, relPath);
}

function restoreVersion(userId, versionId) {
    const db = getDb();
    const row = db
        .prepare('SELECT id, original_path AS originalPath, version_path AS versionPath FROM versions WHERE user_id = ? AND id = ?')
        .get(userId, versionId);
    if (!row) {
        return { ok: false, message: 'Version not found.' };
    }

    const { fullPath: versionFull } = resolveEntryPath(userId, row.versionPath);
    if (!fs.existsSync(versionFull)) {
        return { ok: false, message: 'Version file missing.' };
    }

    const { fullPath: targetFull } = resolveEntryPath(userId, row.originalPath);
    const parentDir = path.dirname(targetFull);
    ensureDir(parentDir);

    fs.copyFileSync(versionFull, targetFull);
    logActivity(userId, 'version-restore', row.originalPath, { versionId });
    return { ok: true };
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

function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

async function exportActivityCsv(userId) {
    const result = await dialog.showSaveDialog({
        title: 'Export Activity Log',
        defaultPath: `vault-activity-${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
    }

    const rows = listActivity(userId, 1000);
    const header = ['created_at', 'action', 'entry_path', 'meta'].join(',');
    const lines = rows.map((row) =>
        [row.createdAt, row.action, row.entryPath || '', row.meta ? JSON.stringify(row.meta) : ''].map(escapeCsv).join(',')
    );

    fs.writeFileSync(result.filePath, [header, ...lines].join('\n'));
    return { ok: true, path: result.filePath };
}

async function exportVaultArchive(userId) {
    const result = await dialog.showSaveDialog({
        title: 'Export Vault Archive',
        defaultPath: `vault-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'Zip', extensions: ['zip'] }],
    });

    if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
    }

    const root = ensureUserRoot(userId);

    return new Promise((resolve) => {
        const output = fs.createWriteStream(result.filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            resolve({ ok: true, path: result.filePath });
        });

        archive.on('error', (error) => {
            resolve({ ok: false, message: error.message });
        });

        archive.pipe(output);
        archive.directory(root, false);
        archive.finalize();
    });
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
    listRecent,
    listFavorites,
    toggleFavorite,
    listTrash,
    restoreTrash,
    purgeTrash,
    getEntryMeta,
    setEntryMeta,
    createVersion,
    listVersions,
    restoreVersion,
    listActivity,
    exportActivityCsv,
    exportVaultArchive,
    rotateUserKey,
};
