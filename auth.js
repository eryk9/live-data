const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const redis = require('./cache');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES = '7d';

// Nodemailer transporter (SMTP)
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        }
    });
} else {
    console.warn('SMTP not configured - emails will be logged to console');
}

async function sendEmail(to, subject, text, html) {
    if (transporter) {
        try {
            await transporter.sendMail({
                from: process.env.FROM_EMAIL || 'no-reply@example.com',
                to,
                subject,
                text,
                html
            });
            return true;
        } catch (err) {
            console.error('Error sending email:', err);
            return false;
        }
    }

    // Fallback: log to console
    console.log(`Email to: ${to}\nSubject: ${subject}\n${text}`);
    return true;
}

// Genera Reset Code
function generateResetCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Signup
async function signup(req, res) {
    const { name, age, email, password } = req.body;
    
    try {
        // Validazioni
        if (!name || !age || !email || !password) {
            return res.status(400).json({ message: 'Dati mancanti' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password minimo 8 caratteri', field: 'Password' });
        }
        
        // Verifica se l'email esiste già
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'Email già registrata', field: 'Email' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Crea utente (is_verified default FALSE)
        const result = await pool.query(
            'INSERT INTO users (name, age, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, age',
            [name, age, email, hashedPassword]
        );
        
        const user = result.rows[0];
        
        // Genera JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );
        // Crea record profilo vuoto (se non esiste)
        try {
            await pool.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);
        } catch (err) {
            console.error('Could not create empty profile:', err);
        }

        // Genera token verifica email e salva in Redis (24h)
        const verifyToken = crypto.randomBytes(32).toString('hex');
        await redis.setex(`verify:${email}`, 24 * 60 * 60, verifyToken);

        const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-email?email=${encodeURIComponent(email)}&token=${verifyToken}`;
        // Invia email di verifica
        await sendEmail(email, 'Verifica il tuo account', `Clicca il link per verificare: ${verifyUrl}`, `<p>Clicca il link per verificare il tuo account: <a href="${verifyUrl}">Verifica Email</a></p>`);

        res.status(201).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                age: user.age
            },
            message: 'Registrazione completata. Controlla la tua email per verificare l\'account.'
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ message: 'Errore nel server' });
    }
}

// Login
async function login(req, res) {
    const { email, password } = req.body;
    
    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email e password richieste' });
        }
        
        // Trova utente
        const result = await pool.query(
            'SELECT id, name, email, age, password_hash, is_verified FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Credenziali non valide' });
        }
        
        const user = result.rows[0];
        
        // Verifica password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Credenziali non valide' });
        }

        // Controlla se email verificata
        if (!user.is_verified) {
            return res.status(403).json({ message: 'Email non verificata. Controlla la tua email.' });
        }
        
        // Genera JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );
        
        // Salva token in Redis per sessioni
        await redis.setex(`token:${token}`, 7 * 24 * 60 * 60, JSON.stringify({ userId: user.id }));
        
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                age: user.age
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Errore nel server' });
    }
}

// Forgot Password - Invia codice
async function forgotPassword(req, res) {
    const { email } = req.body;
    
    try {
        if (!email) {
            return res.status(400).json({ message: 'Email richiesta' });
        }
        
        // Verifica se l'email esiste
        const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Email non trovata' });
        }
        
        // Genera codice reset
        const resetCode = generateResetCode();

        // Salva in Redis (valido per 15 minuti)
        await redis.setex(
            `reset:${email}`,
            15 * 60,
            JSON.stringify({ code: resetCode, createdAt: Date.now() })
        );

        // Invia email con il codice
        const text = `Il tuo codice per reimpostare la password è: ${resetCode} (valido 15 minuti)`;
        await sendEmail(email, 'Reset password', text, `<p>${text}</p>`);

        res.json({ message: 'Codice inviato. Controlla la tua email.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Errore nel server' });
    }
}

// Reset Password
async function resetPassword(req, res) {
    const { email, code, password } = req.body;
    
    try {
        if (!email || !code || !password) {
            return res.status(400).json({ message: 'Dati mancanti' });
        }
        
        // Verifica il codice in Redis
        const resetData = await redis.get(`reset:${email}`);
        if (!resetData) {
            return res.status(400).json({ message: 'Codice scaduto o non valido' });
        }
        
        const { code: savedCode } = JSON.parse(resetData);
        if (savedCode !== code) {
            return res.status(400).json({ message: 'Codice non valido' });
        }
        
        // Hash nuova password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Aggiorna password nel database
        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2',
            [hashedPassword, email]
        );
        
        // Elimina il reset code da Redis
        await redis.del(`reset:${email}`);
        
        res.json({ message: 'Password reimpostata con successo' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Errore nel server' });
    }
}

// Verify email handler (GET or POST)
async function verifyEmail(req, res) {
    const email = req.query.email || req.body.email;
    const token = req.query.token || req.body.token;

    if (!email || !token) return res.status(400).json({ message: 'Dati mancanti' });

    try {
        const saved = await redis.get(`verify:${email}`);
        if (!saved) return res.status(400).json({ message: 'Token scaduto o non valido' });
        if (saved !== token) return res.status(400).json({ message: 'Token non valido' });

        // Imposta is_verified true
        await pool.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [email]);

        // Rimuovi token verifica
        await redis.del(`verify:${email}`);

        // Redirect o risposta JSON
        if (req.accepts('html')) {
            return res.send('<p>Email verificata. Puoi chiudere questa pagina e tornare all\'app.</p>');
        }

        res.json({ message: 'Email verificata' });
    } catch (err) {
        console.error('Verify email error:', err);
        res.status(500).json({ message: 'Errore nel server' });
    }
}

// Middleware per verificare JWT
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Token mancante' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token non valido' });
    }
}

module.exports = {
    signup,
    login,
    forgotPassword,
    resetPassword,
    verifyToken,
    verifyEmail
};
