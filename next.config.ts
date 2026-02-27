import type { NextConfig } from "next";

// CSP: Supabase URL (https + wss), Frankfurter API, blob for PDFs, unsafe-inline for Tailwind/Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const supabaseWs = supabaseUrl.replace("https://", "wss://");

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supabaseUrl}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://api.frankfurter.app`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "@tanstack/react-table",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
