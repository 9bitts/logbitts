import { createAuthClient } from "better-auth/react";

/** Same-origin client — never hardcode localhost (breaks Railway/prod builds). */
export const authClient = createAuthClient();
