import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'quorum-jwt-secret-change-me-in-prod'
)

export interface JWTPayload {
  sub: string        // user UUID
  email: string
  walletAddress?: string
  displayName?: string
}

export async function signJwt(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET)
}

export async function verifyJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
