import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Next.js dev indicators in the browser console
  devIndicators: false,
  // outputFileTracingRoot intentionally NOT set. Inside the sandbox, the
  // app lives at /app, so `path.join(__dirname, "..", "..")` resolved to
  // "/" — the filesystem root — making Next.js treat the entire VM
  // filesystem as the project trace scope. Combined with `poll: 1000`
  // below, that was a sustained memory + CPU drain at compile time.
  // Leaving outputFileTracingRoot unset (Next's default) scopes tracing
  // to the project directory, which is what we want.
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // E2B sandboxes are restored from a VM snapshot, which leaves inotify
      // file descriptors stale. Polling-based watching uses setInterval which
      // survives snapshot restore, ensuring HMR + Tailwind CSS recompilation
      // fires correctly when sandbox.files.write() writes new page files.
      config.watchOptions = {
        poll: 1000, // Reduced from 500ms to lower CPU usage
        aggregateTimeout: 300,
        ignored: ["**/node_modules/**", "**/.next/**", "**/.git/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
