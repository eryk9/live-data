const pool = require('./db');
const logger = require('./logger');

// Recupera il profilo dell'utente autenticato (optimized con JOIN)
async function getMyProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Utente non autenticato' });

  try {
    // JOIN una sola query invece di N+1
    const result = await pool.query(
      `SELECT 
        u.id, u.name, u.age, u.bio, u.photo_url, u.email,
        p.gender, p.interests, p.looking_for
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profilo non trovato' });
    }

    const row = result.rows[0];
    res.json({
      user: {
        id: row.id,
        name: row.name,
        age: row.age,
        bio: row.bio,
        photo_url: row.photo_url,
        email: row.email,
      },
      profile: {
        gender: row.gender,
        interests: row.interests,
        looking_for: row.looking_for,
      }
    });
  } catch (err) {
    logger.error('Get profile error:', err);
    res.status(500).json({ message: 'Errore nel server' });
  }
}

// Recupera il profilo pubblico di un altro utente (optimized con JOIN)
async function getProfileById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ message: 'ID non valido' });

  try {
    // JOIN una sola query
    const result = await pool.query(
      `SELECT 
        u.id, u.name, u.age, u.bio, u.photo_url,
        p.gender, p.interests, p.looking_for
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    const row = result.rows[0];
    res.json({
      user: {
        id: row.id,
        name: row.name,
        age: row.age,
        bio: row.bio,
        photo_url: row.photo_url,
      },
      profile: {
        gender: row.gender,
        interests: row.interests,
        looking_for: row.looking_for,
      }
    });
  } catch (err) {
    logger.error('Get profile by id error:', err);
    res.status(500).json({ message: 'Errore nel server' });
  }
}

// Aggiorna o crea il profilo dell'utente autenticato
async function updateProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Utente non autenticato' });

  const { name, age, bio, gender, interests, looking_for } = req.body;

  try {
    // Prepara interests come array o NULL
    let interestsArr = null;
    if (interests) {
      if (Array.isArray(interests)) interestsArr = interests;
      else if (typeof interests === 'string') {
        interestsArr = interests.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Transaction: aggiorna sia users che profiles
    await pool.query('BEGIN');
    
    await pool.query(
      'UPDATE users SET name = COALESCE($1, name), age = COALESCE($2, age), bio = COALESCE($3, bio), updated_at = NOW() WHERE id = $4',
      [name || null, age || null, bio || null, userId]
    );

    await pool.query(
      `INSERT INTO profiles (user_id, gender, interests, looking_for)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET gender = EXCLUDED.gender, interests = EXCLUDED.interests, looking_for = EXCLUDED.looking_for`,
      [userId, gender || null, interestsArr, looking_for || null]
    );

    await pool.query('COMMIT');
    
    logger.info(`Profile updated for user ${userId}`);
    res.json({ message: 'Profilo aggiornato' });
  } catch (err) {
    await pool.query('ROLLBACK');
    logger.error('Update profile error:', err);
    res.status(500).json({ message: 'Errore nel server' });
  }
}

// Carica foto profilo (multer gestisce il file)
async function uploadPhoto(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Utente non autenticato' });
  if (!req.file) return res.status(400).json({ message: 'File mancante' });

  try {
    const photoUrl = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2', [photoUrl, userId]);
    logger.info(`Photo uploaded for user ${userId}: ${req.file.filename}`);
    res.json({ photo_url: photoUrl });
  } catch (err) {
    logger.error('Upload photo error:', err);
    res.status(500).json({ message: 'Errore nel server' });
  }
}

module.exports = {
  getMyProfile,
  getProfileById,
  updateProfile,
  uploadPhoto,
};
