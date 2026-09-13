import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      type?: string;
      roles?: string[];
      locationId?: string | null;
    };
  }

  interface User {
    type?: string;
    roles?: string[];
    locationId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    type?: string;
    roles?: string[];
    locationId?: string | null;
  }
}
