// Plain .mjs on purpose: `next start` re-parses the config at runtime, and a
// .ts config would require the typescript package inside the prod container.

// Zero-install dev mode: allow `npm run dev` without any .env file. These
// defaults apply in development only — production must set real values.
if (process.env.NODE_ENV === "development") {
  process.env.AUTH_SECRET ??= "insecure-dev-secret-do-not-use-in-production";
  process.env.AUTH_TRUST_HOST ??= "true";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite ships WASM assets that must not be bundled into the server build.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
