import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';

export interface AuthUser {
  login: string;
  displayName: string;
}

const COOKIE_NAME = 'crm_session';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;
const attempts = new Map<string, { count: number; resetAt: number }>();

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const getSecret = () => {
  const secret = process.env.CRM_AUTH_SESSION_SECRET;
  if (!secret || secret.length < 24) throw new Error('CRM_AUTH_SESSION_SECRET precisa ter pelo menos 24 caracteres.');
  return secret;
};

const signToken = (login: string) => {
  const payload = Buffer.from(JSON.stringify({ sub: login, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  const signature = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const verifyToken = (token: string, login: string) => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    return parsed.sub === login && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
};

const authUser = (): AuthUser => ({
  login: process.env.CRM_AUTH_LOGIN || '',
  displayName: process.env.CRM_AUTH_DISPLAY_NAME || 'Thayná Reis',
});

const canTryLogin = (key: string) => {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  current.count += 1;
  return current.count <= 5;
};

const validatePassword = async (password: string) => {
  const hash = process.env.CRM_AUTH_PASSWORD_HASH;
  if (hash) return bcrypt.compare(password, hash);
  if (process.env.NODE_ENV === 'production') return false;
  const devPassword = process.env.CRM_AUTH_PASSWORD || '';
  return Boolean(devPassword) && safeEqual(password, devPassword);
};

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: TOKEN_TTL_MS,
  path: '/',
});

export const loginHandler = async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!canTryLogin(ip)) {
    res.status(429).json({ ok: false, message: 'Muitas tentativas. Aguarde alguns minutos.' });
    return;
  }

  const user = authUser();
  const login = String(req.body?.login || '');
  const password = String(req.body?.password || '');
  const ok = Boolean(user.login) && safeEqual(login, user.login) && await validatePassword(password);
  if (!ok) {
    res.status(401).json({ ok: false, message: 'Login ou senha inválidos.' });
    return;
  }

  attempts.delete(ip);
  res.cookie(COOKIE_NAME, signToken(user.login), cookieOptions());
  res.json({ ok: true, user });
};

export const logoutHandler = (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
};

export const sessionHandler = (req: Request, res: Response) => {
  const user = authUser();
  const token = req.cookies?.[COOKIE_NAME] || '';
  if (!user.login || !token || !verifyToken(token, user.login)) {
    res.status(401).json({ ok: false });
    return;
  }
  res.json({ ok: true, user });
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const user = authUser();
  const token = req.cookies?.[COOKIE_NAME] || '';
  if (!user.login || !token || !verifyToken(token, user.login)) {
    res.status(401).json({ ok: false, message: 'Sessão inválida.' });
    return;
  }
  next();
};

export const hashPassword = async (password: string) => bcrypt.hash(password, 12);
