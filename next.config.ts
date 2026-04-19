import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    // Redirects no Edge (antes de qualquer prerender) — evita que o Vercel
    // continue servindo HTML estático antigo das rotas V1 legadas.
    return [
      {
        source: "/app/create",
        destination: "/app/create/new",
        permanent: false,
      },
      {
        source: "/app/create-v2",
        destination: "/app/create/new",
        permanent: false,
      },
      {
        source: "/app/create/legacy",
        destination: "/app/create/new",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  async headers() {
    // Força fresh em TODA rota /app/* pra evitar Vercel edge cache servir HTML
    // shell antigo após deploy (o HTML aponta pros chunks JS pelo hash, e se
    // o shell está em cache velho, o browser acaba puxando bundle antigo).
    return [
      {
        source: "/app/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
