const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production-make-it-long-and-random';
const dbPath = path.join(__dirname, 'app.db.json');

function readDB() {
  if (!fs.existsSync(dbPath)) return { users: [], jobs: [], projects: [] };
  try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!data.jobs) data.jobs = [];
    if (!data.projects) data.projects = [];
    if (!data.transcripts) data.transcripts = [];
    return data;
  } catch(e) {
    return { users: [], jobs: [], projects: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function initDB() {
  if (!fs.existsSync(dbPath)) {
    writeDB({ users: [], jobs: [], projects: [], transcripts: [] });
  }
  console.log('JSON DB initialized at', dbPath);
}

// simple export for the credits module to use
const db = {
  get: () => readDB(),
  save: (data) => writeDB(data)
};

async function signup(email, password, name) {
  const data = readDB();
  if (data.users.find(u => u.email === email)) throw new Error('Email already registered');

  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now(),
    email,
    password_hash: hash,
    name: name || email.split('@')[0],
    credits: 300,
    videos_used: 0,
    created_at: new Date().toISOString()
  };
  
  data.users.push(user);
  writeDB(data);

  const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '30d' });
  return {
    token,
    user: { id: user.id, email, name: user.name, credits: 300, videos_used: 0 }
  };
}

async function login(email, password) {
  const data = readDB();
  const user = data.users.find(u => u.email === email);
  if (!user) throw new Error('Invalid credentials');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new Error('Invalid credentials');

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, credits: user.credits, videos_used: user.videos_used }
  };
}

const { supabase } = require('./supabase');

async function authMiddleware(req, res, next) {
  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // For this migration step, we only attach the verified Supabase UUID
    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { db, initDB, signup, login, authMiddleware };
