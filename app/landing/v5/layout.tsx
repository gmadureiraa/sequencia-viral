import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { GeistPixelLine } from "geist/font/pixel";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Sequência Viral — Nexus (v5)",
  description: "Variante de landing estilo Nexus / plataforma IA dark.",
};

export default function LandingV5Layout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${jetbrainsMono.variable} ${GeistPixelLine.variable} landing-nexus-scope min-h-screen bg-background text-foreground antialiased`}
    >
      {children}
    </div>
  );
}
