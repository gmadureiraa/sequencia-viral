import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Instrument_Serif,
  JetBrains_Mono,
  DM_Serif_Display,
  Playfair_Display,
  Outfit,
  Inter,
  Source_Sans_3,
  Literata,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { LANDING_FAQ } from "@/lib/landing-faq";
import "./globals.css";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sequência Viral — Carrosséis com IA para Instagram, LinkedIn e X",
  description:
    "Cinco conceitos, três variações por tema, formato thread (Twitter/X), modo rápido ou Content Machine. Export PNG num fluxo só.",
  metadataBase: new URL("https://viral.kaleidos.com.br"),
  keywords: [
    "gerador de carrossel",
    "carrossel instagram ia",
    "criar carrossel instagram",
    "carousel maker",
    "linkedin carousel",
    "conteúdo redes sociais ia",
    "thread visual",
    "sequencia-viral",
    "export png carrossel",
  ],
  alternates: {
    canonical: "https://viral.kaleidos.com.br",
  },
  openGraph: {
    title: "Sequência Viral — Carrosséis com IA em um fluxo só",
    description:
      "Conceitos, variações, preview estilo thread e edição completa antes do export. Instagram, LinkedIn e X.",
    type: "website",
    url: "https://viral.kaleidos.com.br",
    siteName: "Sequência Viral",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sequência Viral — Carrosséis com IA",
    description:
      "Cinco conceitos e três variações por tema, formato thread, export PNG. Para quem publica em escala.",
    site: "@sequencia-viral",
    creator: "@sequencia-viral",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sequência Viral",
  description:
    "Geração de carrosséis com IA para Instagram, X e LinkedIn. Cinco conceitos, três variações, formato thread, modo rápido ou Content Machine.",
  url: "https://viral.kaleidos.com.br",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: "5 carrosséis por mês com marca d'água Sequência Viral",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "9.99",
      priceCurrency: "USD",
      billingIncrement: "P1M",
      description: "30 carrosséis por mês, sem marca d'água, export PNG",
    },
    {
      "@type": "Offer",
      name: "Business",
      price: "29.99",
      priceCurrency: "USD",
      billingIncrement: "P1M",
      description: "Carrosséis ilimitados, API, 3 seats, analytics",
    },
  ],
  featureList: [
    "5 conceitos e até 3 variações de carrossel por tema (dados, narrativa, provocação)",
    "Preview no formato thread (Twitter/X)",
    "Modo rápido ou modo avançado (Content Machine) para a copy",
    "Branding com foto de perfil e @handle",
    "Entrada por URL, vídeo (YouTube), Instagram ou texto",
    "Imagens por busca ou geração com IA alinhadas ao tema do slide",
    "Export em PNG otimizado para redes (PDF em roadmap)",
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQ.map((item) => ({
    "@type": "Question" as const,
    name: item.q,
    acceptedAnswer: { "@type": "Answer" as const, text: item.a },
  })),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${jakarta.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${dmSerifDisplay.variable} ${playfair.variable} ${outfit.variable} ${inter.variable} ${sourceSans.variable} ${literata.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("sequencia-viral_theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}` }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </head>
      <body className="min-h-screen font-[family-name:var(--font-sans)]">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
      {GA_MEASUREMENT_ID ? <GoogleAnalytics gaId={GA_MEASUREMENT_ID} /> : null}
    </html>
  );
}
