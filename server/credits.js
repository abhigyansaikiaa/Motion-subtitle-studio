const { db } = require('./auth');

function checkCredits(userId) {
  const data = db.get();
  const user = data.users.find(u => u.id === userId);
  return user ? { credits: user.credits, videos_used: user.videos_used } : null;
}

function deductCredits(userId, amount) {
  const data = db.get();
  const user = data.users.find(u => u.id === userId);
  if (user) {
    user.credits -= amount;
    db.save(data);
  }
}

function addCredits(userId, amount) {
  const data = db.get();
  const user = data.users.find(u => u.id === userId);
  if (user) {
    user.credits += amount;
    db.save(data);
  }
}

function incrementVideosUsed(userId) {
  const data = db.get();
  const user = data.users.find(u => u.id === userId);
  if (user) {
    user.videos_used += 1;
    db.save(data);
  }
}

module.exports = { checkCredits, deductCredits, addCredits, incrementVideosUsed };
