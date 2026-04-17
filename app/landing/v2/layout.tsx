import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sequência Viral — Brillance (v2)",
  description: "Variante de landing estilo Brillance / SaaS limpo.",
};

export default function LandingV2Layout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} landing-brillance-scope min-h-screen bg-background text-foreground antialiased`}
    >
      {children}
    </div>
  );
}
