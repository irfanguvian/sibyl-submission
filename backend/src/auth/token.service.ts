import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Role } from "@prisma/client";
import type { Env } from "../env";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenPayload, AuthenticatedUser, TokenPair } from "./auth.types";

/**
 * Issues, verifies, rotates, and revokes DB-persisted JWT access/refresh tokens.
 *
 * Design (D3): the access token is a signed JWT; its `jti` hash is stored in
 * `oauth_access_token`. Every authenticated request re-checks that row, so a
 * token can be revoked server-side before its JWT expiry. Refresh tokens are
 * opaque random strings; only their sha256 hash is stored. Refresh rotation
 * revokes the old pair; reuse of an already-revoked refresh token revokes the
 * user's entire token family.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  async issuePair(user: { id: string; role: Role }): Promise<TokenPair> {
    const accessTtl = this.config.get("ACCESS_TOKEN_TTL", { infer: true });
    const refreshTtl = this.config.get("REFRESH_TOKEN_TTL", { infer: true });
    const now = Date.now();

    const jti = randomUUID();
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, jti };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtl });

    const accessRow = await this.prisma.oauthAccessToken.create({
      data: {
        userId: user.id,
        tokenHash: this.sha256(jti),
        expiresAt: new Date(now + accessTtl * 1000),
      },
    });

    const rawRefresh = randomBytes(32).toString("hex");
    await this.prisma.oauthRefreshToken.create({
      data: {
        accessTokenId: accessRow.id,
        tokenHash: this.sha256(rawRefresh),
        expiresAt: new Date(now + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn: accessTtl };
  }

  /** Verify a bearer access token: signature + expiry, then DB revocation check. */
  async verifyAccess(token: string): Promise<AuthenticatedUser> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const row = await this.prisma.oauthAccessToken.findUnique({
      where: { tokenHash: this.sha256(payload.jti) },
    });
    if (!row || row.revokedAt !== null || row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Token revoked or expired");
    }

    return { id: payload.sub, role: payload.role, jti: payload.jti };
  }

  /** Rotate a refresh token, returning a new pair. Detects + punishes reuse. */
  async rotate(rawRefresh: string): Promise<TokenPair> {
    const row = await this.prisma.oauthRefreshToken.findUnique({
      where: { tokenHash: this.sha256(rawRefresh) },
      include: { accessToken: { include: { user: true } } },
    });

    if (!row) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Reuse of an already-revoked refresh token → revoke the whole family.
    if (row.revokedAt !== null) {
      await this.revokeFamily(row.accessToken.userId);
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    await this.revokeAccessTokenById(row.accessTokenId);
    return this.issuePair({
      id: row.accessToken.userId,
      role: row.accessToken.user.role,
    });
  }

  /** Logout: revoke the access token (by jti) and its paired refresh token. */
  async revokeByAccessJti(jti: string): Promise<void> {
    const row = await this.prisma.oauthAccessToken.findUnique({
      where: { tokenHash: this.sha256(jti) },
    });
    if (row) {
      await this.revokeAccessTokenById(row.id);
    }
  }

  private async revokeAccessTokenById(accessTokenId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.oauthAccessToken.update({
        where: { id: accessTokenId },
        data: { revokedAt: now },
      }),
      this.prisma.oauthRefreshToken.updateMany({
        where: { accessTokenId },
        data: { revokedAt: now },
      }),
    ]);
  }

  /** Revoke every access + refresh token belonging to a user. */
  async revokeFamily(userId: string): Promise<void> {
    const now = new Date();
    const tokens = await this.prisma.oauthAccessToken.findMany({
      where: { userId },
      select: { id: true },
    });
    const ids = tokens.map((t) => t.id);
    await this.prisma.$transaction([
      this.prisma.oauthAccessToken.updateMany({
        where: { userId },
        data: { revokedAt: now },
      }),
      this.prisma.oauthRefreshToken.updateMany({
        where: { accessTokenId: { in: ids } },
        data: { revokedAt: now },
      }),
    ]);
  }
}
