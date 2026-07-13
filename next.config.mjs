// Plain .mjs on purpose: `next start` re-parses the config at runtime, and a
// .ts config would require the typescript package inside the prod container.

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
