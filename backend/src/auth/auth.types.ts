import type { Role } from "@prisma/client";

/** The authenticated principal attached to a request by the JWT guard. */
export type AuthenticatedUser = {
  id: string;
  role: Role;
  /** JWT id of the access token — needed to revoke the exact token on logout. */
  jti: string;
};

/** A freshly issued access + refresh token pair. */
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
};

/** Decoded access-token JWT payload. */
export type AccessTokenPayload = {
  sub: string;
  role: Role;
  jti: string;
};
