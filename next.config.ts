import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile)
  output: "standalone",
  experimental: {
    // Photo / kundli uploads and spreadsheet imports go through server actions.
    serverActions: { bodySizeLimit: "20mb" },
    // Middleware runs on every request (login check); by default it cuts bodies at 10 MB.
    middlewareClientMaxBodySize: "20mb",
  },
  poweredByHeader: false,
  async headers() {
    return [
      // Everything except the public enquiry form: never inside another site's frame
      { source: "/((?!join/).*)", headers: securityHeaders },
      // The enquiry form may be embedded on the bureau's own website (iframe)
      {
        source: "/join/:path*",
        headers: [...securityHeaders.filter((h) => h.key !== "X-Frame-Options"), { key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
