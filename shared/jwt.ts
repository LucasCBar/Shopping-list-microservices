// shared/jwt.ts
import { sign, verify, type SignOptions, type Secret } from 'jsonwebtoken';

type JwtExpiry = SignOptions['expiresIn'];

export function signJwt(
  payload: any,
  secret: string,
  expiresIn: JwtExpiry = '6h' as unknown as JwtExpiry
): string {
  const opts: SignOptions = {};
  (opts as any).expiresIn = expiresIn;
  return sign(payload as object, secret as Secret, opts);
}

export function verifyJwt(token: string, secret: string): any {
  return verify(token, secret) as any;
}

// 👇 sem importar RequestHandler aqui; deixamos “any” para não travar tipos
export function authMiddleware(secret: string) {
  return (req: any, res: any, next: any) => {
    const hdr = (req.headers['authorization'] || '') as string;
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing_token' });
    try {
      const decoded = verifyJwt(token, secret);
      (req as any).user = { id: decoded.sub, email: decoded.email, username: decoded.username };
      next();
    } catch {
      return res.status(401).json({ error: 'invalid_token' });
    }
  };
}
