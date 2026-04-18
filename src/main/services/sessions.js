const sessionKeys = new Map();

function setUserKey(userId, key) {
  sessionKeys.set(Number(userId), key);
}

function getUserKey(userId) {
  return sessionKeys.get(Number(userId));
}

function clearUserKey(userId) {
  sessionKeys.delete(Number(userId));
}

module.exports = {
  setUserKey,
  getUserKey,
  clearUserKey,
};
