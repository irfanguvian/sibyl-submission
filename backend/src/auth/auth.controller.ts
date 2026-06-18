import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser } from "./auth.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { MeResponseDto, TokenResponseDto } from "./dto/auth-responses.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  // Brute-force protection: 5 attempts per minute per IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Log in with email + password" })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  @ApiTooManyRequestsResponse({ description: "Too many login attempts" })
  login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate a refresh token for a new token pair" })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid/expired/reused refresh token" })
  refresh(@Body() dto: RefreshDto): Promise<TokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke the current access + refresh token pair" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid token" })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.jti);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the currently authenticated user" })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid token" })
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponseDto> {
    return this.authService.me(user.id);
  }
}
