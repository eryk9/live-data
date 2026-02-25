const pool = require('./db');

// Recupera il profilo dell'utente autenticato
async function getMyProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Utente non autenticato' });

  try {
    const userRes = await pool.query(
      'SELECT id, name, age, bio, photo_url, email FROM users WHERE id = $1',
      [userId]
    );

    const profileRes = await pool.query(
      'SELECT gender, interests, looking_for FROM profiles WHERE user_id = $1',
      [userId]
    );

    const user = userRes.rows[0] || null;
    const profile = profileRes.rows[0] || null;

    res.json({ user, profile });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Errore nel server' });
  }
}

// Recupera il profilo pubblico di un altro utente
async function getProfileById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ message: 'ID non valido' });

  try {
    const userRes = await pool.query(
      'SELECT id, name, age, bio, photo_url FROM users WHERE id = $1',
      [id]
    );

    const profileRes = await pool.query(
      'SELECT gender, interests, looking_for FROM profiles WHERE user_id = $1',
      [id]
    );

    const user = userRes.rows[0] || null;
    const profile = profileRes.rows[0] || null;

    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    res.json({ user, profile });
  } catch (err) {
    console.error('Get profile by id error:', err);
    res.status(500).json({ message: 'Errore nel server' });
  }
}

// Aggiorna o crea il profilo dell'utente autenticato
async function updateProfile(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Utente non autenticato' });

  const { name, age, bio, gender, interests, looking_for } = req.body;

  try {
    // Aggiorna la tabella users
    await pool.query(
      'UPDATE users SET name = COALESCE($1, name), age = COALESCE($2, age), bio = COALESCE($3, bio), updated_at = NOW() WHERE id = $4',
      [name, age || null, bio || null, userId]
    );

    // Prepara interests come array o NULL
    let interestsArr = null;
    if (interests) {
      if (Array.isArray(interests)) interestsArr = interests;
      else if (typeof interests === 'string') {
        interestsArr = interests.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Upsert nella tabella profiles
    await pool.query(
      `INSERT INTO profiles (user_id, gender, interests, looking_for)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET gender = EXCLUDED.gender, interests = EXCLUDED.interests, looking_for = EXCLUDED.looking_for`,
      [userId, gender || null, interestsArr, looking_for || null]
    );

    res.json({ message: 'Profilo aggiornato' });
  } catch (err) {
    console.error('Update profile error:', err);
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
    res.json({ photo_url: photoUrl });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ message: 'Errore nel server' });
  }
}

module.exports = {
  getMyProfile,
  getProfileById,
  updateProfile,
  uploadPhoto,
};
