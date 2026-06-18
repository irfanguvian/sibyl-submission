import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Mark a route as not requiring authentication (skips {@link JwtAuthGuard}). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
