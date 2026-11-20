import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.ts';
import { getDb } from '../db/pglite.ts';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      sub: number | string;
      email: string;
      name: string;
      role: string;
    };
    return {
      id: Number(decoded.sub),
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export async function getDefaultDemoUser(): Promise<AuthUser> {
  const pg = await getDb();
  const res = await pg.query<AuthUser>(
    'SELECT id, name, email, role FROM app_users WHERE email = $1 LIMIT 1',
    ['demo@intellibi.ai']
  );
  if (res.rows[0]) {
    return res.rows[0];
  }
  const anyUser = await pg.query<AuthUser>(
    'SELECT id, name, email, role FROM app_users ORDER BY id ASC LIMIT 1'
  );
  if (!anyUser.rows[0]) {
    throw new Error('Default workspace user not initialized.');
  }
  return anyUser.rows[0];
}

/**
 * Extracts authenticated user from Bearer JWT header.
 * Strict middleware for explicitly protected endpoints.
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const decoded = verifyAuthToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
    return;
  }

  const pg = await getDb();
  const userRes = await pg.query<AuthUser>(
    'SELECT id, name, email, role FROM app_users WHERE id = $1 LIMIT 1',
    [decoded.id]
  );
  if (!userRes.rows[0]) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }

  req.user = userRes.rows[0];
  next();
}
