/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL: string;
  readonly DATABASE_URL: string;
  readonly BETTER_AUTH_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    usuario: {
      id: string;
      email: string;
      name: string;
      telefono?: string | null;
      rol?: string | null;
    } | null;
  }
}
