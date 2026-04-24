const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const redis = require('./cache');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const logger = require('./logger');
const config = require('./config');

// Nodemailer transporter (SMTP) - istanziato una sola volta
let transporter = null;
if (config.SMTP.host && config.SMTP.user) {
    transporter = nodemailer.createTransport({
        host: config.SMTP.host,
        port: config.SMTP.port,
        secure: config.SMTP.secure,
        auth: {
            user: config.SMTP.user,
            pass: config.SMTP.pass,
        }
    });
    logger.info('SMTP transporter initialized');
} else {
    logger.warn('SMTP not configured - emails will be logged to console');
}

async function sendEmail(to, subject, text, html) {
    if (transporter) {
        try {
            await transporter.sendMail({
                from: config.SMTP.from,
                to,
                subject,
                text,
                html
            });
            logger.debug(`Email sent to ${to}`);
            return true;
        } catch (err) {
            logger.error('Error sending email:', err);
            return false;
        }
    }

    // Fallback: log to console
    logger.warn(`Email (not sent - SMTP disabled): to=${to}, subject=${subject}`);
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
            config.JWT_SECRET,
            { expiresIn: config.JWT_EXPIRES }
        );
        // Crea record profilo vuoto (se non esiste)
        try {
            await pool.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);
        } catch (err) {
            logger.error('Could not create empty profile:', err);
        }

        // Genera token verifica email e salva in Redis (24h)
        const verifyToken = crypto.randomBytes(32).toString('hex');
        await redis.setex(`verify:${email}`, 24 * 60 * 60, verifyToken);

        const verifyUrl = `${config.APP_URL}/api/auth/verify-email?email=${encodeURIComponent(email)}&token=${verifyToken}`;
        // Invia email di verifica
        await sendEmail(email, 'Verifica il tuo account', `Clicca il link per verificare: ${verifyUrl}`, `<p>Clicca il link per verificare il tuo account: <a href="${verifyUrl}">Verifica Email</a></p>`);

        logger.info(`User registered: ${email}`);
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
        logger.error('Signup error:', err);
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
            logger.warn(`Login failed: unknown email ${email}`);
            return res.status(401).json({ message: 'Credenziali non valide' });
        }
        
        const user = result.rows[0];
        
        // Verifica password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            logger.warn(`Login failed: invalid password for ${email}`);
            return res.status(401).json({ message: 'Credenziali non valide' });
        }

        // Controlla se email verificata
        if (!user.is_verified) {
            return res.status(403).json({ message: 'Email non verificata. Controlla la tua email.' });
        }
        
        // Genera JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            config.JWT_SECRET,
            { expiresIn: config.JWT_EXPIRES }
        );
        
        // Salva token in Redis per sessioni
        await redis.setex(`token:${token}`, 7 * 24 * 60 * 60, JSON.stringify({ userId: user.id }));
        
        logger.info(`User logged in: ${email}`);
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
        logger.error('Login error:', err);
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
            // Security: non rivelo se l'email esiste o no
            return res.json({ message: 'Se l\'email esiste, riceverai un codice.' });
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

        logger.info(`Password reset requested for: ${email}`);
        res.json({ message: 'Se l\'email esiste, riceverai un codice.' });
    } catch (err) {
        logger.error('Forgot password error:', err);
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
            logger.warn(`Invalid reset attempt for: ${email} (expired code)`);
            return res.status(400).json({ message: 'Codice scaduto o non valido' });
        }
        
        const { code: savedCode } = JSON.parse(resetData);
        if (savedCode !== code) {
            logger.warn(`Invalid reset code for: ${email}`);
            return res.status(400).json({ message: 'Codice non valido' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password minimo 8 caratteri' });
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
        
        logger.info(`Password reset completed for: ${email}`);
        res.json({ message: 'Password reimpostata con successo' });
    } catch (err) {
        logger.error('Reset password error:', err);
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
        if (!saved) {
            logger.warn(`Invalid email verification attempt for: ${email} (expired token)`);
            return res.status(400).json({ message: 'Token scaduto o non valido' });
        }
        if (saved !== token) {
            logger.warn(`Invalid email verification attempt for: ${email} (wrong token)`);
            return res.status(400).json({ message: 'Token non valido' });
        }

        // Imposta is_verified true
        await pool.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [email]);

        // Rimuovi token verifica
        await redis.del(`verify:${email}`);

        logger.info(`Email verified for: ${email}`);
        
        // Redirect o risposta JSON
        if (req.accepts('html')) {
            return res.send('<p>Email verificata. Puoi chiudere questa pagina e tornare all\'app.</p>');
        }

        res.json({ message: 'Email verificata' });
    } catch (err) {
        logger.error('Verify email error:', err);
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
        const decoded = jwt.verify(token, config.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        logger.warn('Invalid token verification attempt');
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
