import { Injectable, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import type { TokenPair } from "./auth.types";
import type { MeResponseDto } from "./dto/auth-responses.dto";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always run a comparison shape; reject with a single generic message to
    // avoid leaking which of email/password was wrong.
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.tokens.issuePair({ id: user.id, role: user.role });
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(jti: string): Promise<void> {
    await this.tokens.revokeByAccessJti(jti);
  }

  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    return user;
  }
}
