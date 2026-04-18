const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;
const KEY_SALT_BYTES = 16;

function hashPassword(password) {
    return bcrypt.hashSync(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

function createSalt() {
    return crypto.randomBytes(KEY_SALT_BYTES).toString('hex');
}

function deriveKey(password, salt) {
    const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt), 'hex');
    return crypto.scryptSync(password, saltBuffer, 32);
}

function encryptBuffer(buffer, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
}

function decryptBuffer(buffer, key) {
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

module.exports = {
    hashPassword,
    verifyPassword,
    createSalt,
    deriveKey,
    encryptBuffer,
    decryptBuffer,
};
