import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/pglite.ts';
import {
  getDefaultDemoUser,
  hashPassword,
  requireAuth,
  signAuthToken,
  verifyPassword,
  type AuthRequest,
} from '../core/auth.ts';
import { config } from '../core/config.ts';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(150),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const settingsSchema = z.object({
  maxRows: z.number().int().min(10).max(1000),
  queryTimeoutMs: z.number().int().min(1000).max(30000),
});

async function getUserSettings(userId: number) {
  const pg = await getDb();
  const res = await pg.query<{ max_rows: number; query_timeout_ms: number }>(
    'SELECT max_rows, query_timeout_ms FROM app_settings WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (res.rows[0]) {
    return {
      maxRows: res.rows[0].max_rows,
      queryTimeoutMs: res.rows[0].query_timeout_ms,
    };
  }
  return {
    maxRows: config.defaultMaxQueryRows,
    queryTimeoutMs: config.defaultQueryTimeoutMs,
  };
}

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
      return;
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const pg = await getDb();

    const existing = await pg.query<{ id: number }>(
      'SELECT id FROM app_users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const created = await pg.query<{ id: number; name: string; email: string; role: string }>(
      `INSERT INTO app_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, normalizedEmail, passwordHash, 'Data Analyst']
    );

    const user = created.rows[0];
    await pg.query(
      `INSERT INTO app_settings (user_id, max_rows, query_timeout_ms)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, config.defaultMaxQueryRows, config.defaultQueryTimeoutMs]
    );

    const token = signAuthToken(user);
    const settings = await getUserSettings(user.id);
    res.status(201).json({ token, user, settings });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid login credentials.' });
      return;
    }

    const { email, password } = parsed.data;
    const pg = await getDb();
    const found = await pg.query<{
      id: number;
      name: string;
      email: string;
      role: string;
      password_hash: string;
    }>(
      'SELECT id, name, email, role, password_hash FROM app_users WHERE email = $1 LIMIT 1',
      [email.toLowerCase()]
    );

    const row = found.rows[0];
    if (!row) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const matches = await verifyPassword(password, row.password_hash);
    if (!matches) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = signAuthToken(user);
    const settings = await getUserSettings(user.id);
    res.json({ token, user, settings });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

router.post('/demo', async (_req, res) => {
  try {
    const user = await getDefaultDemoUser();
    const token = signAuthToken(user);
    const settings = await getUserSettings(user.id);
    res.json({ token, user, settings });
  } catch (err) {
    console.error('Demo session error:', err);
    res.status(500).json({ error: 'Unable to initialize workspace session.' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const settings = await getUserSettings(req.user!.id);
    res.json({ user: req.user, settings });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Unable to load user profile.' });
  }
});

router.patch('/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings.' });
      return;
    }

    const pg = await getDb();
    await pg.query(
      `INSERT INTO app_settings (user_id, max_rows, query_timeout_ms, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET max_rows = EXCLUDED.max_rows, query_timeout_ms = EXCLUDED.query_timeout_ms, updated_at = CURRENT_TIMESTAMP`,
      [req.user!.id, parsed.data.maxRows, parsed.data.queryTimeoutMs]
    );

    res.json({
      settings: {
        maxRows: parsed.data.maxRows,
        queryTimeoutMs: parsed.data.queryTimeoutMs,
      },
    });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Unable to save workspace settings.' });
  }
});

export default router;
