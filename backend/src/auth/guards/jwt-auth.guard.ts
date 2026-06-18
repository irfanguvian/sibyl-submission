import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth.types";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { TokenService } from "../token.service";

/** Authenticates requests via bearer access token + DB revocation check. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    request.user = await this.tokenService.verifyAccess(token);
    return true;
  }

  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(" ");
    return scheme === "Bearer" && value ? value : null;
  }
}
