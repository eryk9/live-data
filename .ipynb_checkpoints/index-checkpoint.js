const express = require('express');
require('dotenv').config();
const path = require('path');
const pool = require('./db');
const redis = require('./cache');
const { signup, login, forgotPassword, resetPassword, verifyToken, verifyEmail } = require('./auth');
const { getMyProfile, getProfileById, updateProfile, uploadPhoto } = require('./profiles');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth Routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.post('/api/auth/forgot-password', forgotPassword);
app.post('/api/auth/reset-password', resetPassword);
app.get('/api/auth/verify-email', verifyEmail);

// Protected API Routes
app.get('/api', verifyToken, (req, res) => {
  res.json({ message: 'App di Dating - API', user: req.user });
});

// Profile routes
app.get('/api/profile/me', verifyToken, getMyProfile);
app.get('/api/profile/:id', verifyToken, getProfileById);
app.post('/api/profile', verifyToken, updateProfile);

// Preparazione cartella uploads e multer
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/profile/photo', verifyToken, upload.single('photo'), uploadPhoto);

// Socket.IO setup for real-time chat
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    return next();
  } catch (err) {
    return next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;
  console.log('Socket connected:', user?.id);

  socket.on('join_match', (matchId) => {
    if (!matchId) return;
    socket.join(`match:${matchId}`);
  });

  socket.on('leave_match', (matchId) => {
    if (!matchId) return;
    socket.leave(`match:${matchId}`);
  });

  socket.on('send_message', async (payload, cb) => {
    try {
      const { matchId, content } = payload || {};
      if (!matchId || !content) return cb && cb({ error: 'Dati mancanti' });

      const senderId = socket.user.id;

      // Verifica che il match esista e che l'utente sia parte
      const matchRes = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
      if (matchRes.rows.length === 0) return cb && cb({ error: 'Match non trovato' });
      const match = matchRes.rows[0];
      if (match.user_id_1 !== senderId && match.user_id_2 !== senderId) return cb && cb({ error: 'Non autorizzato' });

      const result = await pool.query(
        'INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, created_at',
        [matchId, senderId, content]
      );

      const message = {
        id: result.rows[0].id,
        match_id: matchId,
        sender_id: senderId,
        content,
        created_at: result.rows[0].created_at
      };

      io.to(`match:${matchId}`).emit('new_message', message);
      cb && cb({ ok: true, message });
    } catch (err) {
      console.error('Socket send_message error:', err);
      cb && cb({ error: 'Server error' });
    }
  });

  socket.on('disconnect', () => {});
});

// Check status database e cache
app.get('/api/status', async (req, res) => {
  try {
    // Test PostgreSQL
    const dbResult = await pool.query('SELECT NOW()');
    
    // Test Redis
    await redis.ping();
    
    res.json({
      postgres: 'Connesso',
      redis: 'Connesso',
      timestamp: dbResult.rows[0].now,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API di prova - Getting users (con cache Redis)
app.get('/api/users', verifyToken, async (req, res) => {
  try {
    const cacheKey = 'users:all';
    
    // Prova a recuperare dal cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ data: JSON.parse(cached), source: 'cache' });
    }
    
    // Query dal database
    const result = await pool.query('SELECT id, name, age FROM users LIMIT 10');
    
    // Salva in cache per 1 ora
    await redis.setex(cacheKey, 3600, JSON.stringify(result.rows));
    
    res.json({ data: result.rows, source: 'database' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve login page
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve signup page
app.get('/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Serve forgot password page
app.get('/forgot-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

// Avvio server (usiamo HTTP server creato per Socket.IO)
server.listen(port, () => {
  console.log(`\n🚀 App listening on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔐 Login: http://localhost:${port}/login`);
  console.log(`📝 Signup: http://localhost:${port}/signup`);
  console.log(`💾 Database: PostgreSQL`);
  console.log(`⚡ Cache: Redis\n`);
});
