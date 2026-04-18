const { getDb } = require('../db');
const { hashPassword, verifyPassword } = require('./crypto');

function getSetting(key) {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setSetting(key, value) {
    const db = getDb();
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .run(key, value);
}

function clearSetting(key) {
    const db = getDb();
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

function getSettingsSummary() {
    const startupHash = getSetting('startup_password_hash');
    const theme = getSetting('theme') || 'neon';
    return {
        startupEnabled: Boolean(startupHash),
        theme,
    };
}

function setStartupPassword(password) {
    const hash = hashPassword(password);
    setSetting('startup_password_hash', hash);
    return { ok: true };
}

function clearStartupPassword() {
    clearSetting('startup_password_hash');
    return { ok: true };
}

function verifyStartupPassword(password) {
    const hash = getSetting('startup_password_hash');
    if (!hash) {
        return { ok: true };
    }
    const matches = verifyPassword(password, hash);
    return matches ? { ok: true } : { ok: false, message: 'Incorrect startup password.' };
}

function setTheme(theme) {
    setSetting('theme', theme);
    return { ok: true };
}

module.exports = {
    getSettingsSummary,
    setStartupPassword,
    clearStartupPassword,
    verifyStartupPassword,
    setTheme,
};
