/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The core package ships TypeScript source so the same code can be reused by
  // native wrappers later without a build step.
  transpilePackages: ["@photomaker/core"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // wasm-unsafe-eval is required by the MediaPipe WASM runtime (§7).
              "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data:",
              // Model files only. No endpoint accepts image data — by design.
              "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/models/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
