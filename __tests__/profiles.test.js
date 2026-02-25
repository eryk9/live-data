const profiles = require('../profiles');
const pool = require('../db');

jest.mock('../db', () => ({
  query: jest.fn(),
}));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('profiles handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getMyProfile returns user and profile when present', async () => {
    const req = { user: { id: 1 } };
    const res = mockRes();

    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Marco', age: 25, bio: 'Ciao', photo_url: '/uploads/1.jpg', email: 'm@example.com' }] })
      .mockResolvedValueOnce({ rows: [{ gender: 'male', interests: ['music','sport'], looking_for: 'female' }] });

    await profiles.getMyProfile(req, res);

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object), profile: expect.any(Object) }));
  });

  test('getProfileById returns 404 when user not found', async () => {
    const req = { params: { id: '999' } };
    const res = mockRes();

    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await profiles.getProfileById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Utente non trovato' });
  });

  test('updateProfile upserts profile and updates users', async () => {
    const req = {
      user: { id: 2 },
      body: { name: 'Luisa', age: 30, bio: 'Bio', gender: 'female', interests: 'cinema,arte', looking_for: 'male' }
    };
    const res = mockRes();

    pool.query.mockResolvedValue({ rows: [] });

    await profiles.updateProfile(req, res);

    // dovrebbe chiamare query di update users e INSERT/UPDATE profiles
    expect(pool.query).toHaveBeenCalled();
    expect(pool.query.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(res.json).toHaveBeenCalledWith({ message: 'Profilo aggiornato' });
  });

  test('uploadPhoto updates photo_url', async () => {
    const req = { user: { id: 3 }, file: { filename: '3-12345.jpg' } };
    const res = mockRes();

    pool.query.mockResolvedValue({ rows: [] });

    await profiles.uploadPhoto(req, res);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET photo_url'), expect.any(Array));
    expect(res.json).toHaveBeenCalledWith({ photo_url: '/uploads/3-12345.jpg' });
  });
});
