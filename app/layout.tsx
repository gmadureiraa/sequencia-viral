import type { Metadata, Viewport } from "next";
import {
  Plus_Jakarta_Sans,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { LANDING_FAQ } from "@/lib/landing-faq";
import { MetaPixel } from "@/components/MetaPixel";
import "./globals.css";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// ── Fontes root layout: apenas 3 (Jakarta sans, Instrument Serif display, JetBrains mono).
// Fontes editoriais extras (DM Serif, Playfair, Outfit, Inter, Source Sans 3, Literata)
// vivem no layout do editor (`app/app/create/[id]/edit/layout.tsx`) — só carregam
// quando o user abre a tela de edição. Mantém o root layout enxuto pra LCP da landing.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#F7F5EF",
  colorScheme: "light",
  viewportFit: "cover", // safe-area insets pra iPhone com notch/Dynamic Island
};

export const metadata: Metadata = {
  title: "Sequência Viral — Carrosséis com IA para Instagram, LinkedIn e X",
  description:
    "Carrossel pronto em ~60 segundos. Cola um link, a IA escreve no seu tom, monta os slides e entrega pra postar. Templates Futurista + Twitter.",
  metadataBase: new URL("https://viral.kaleidos.com.br"),
  keywords: [
    "gerador de carrossel",
    "carrossel instagram ia",
    "criar carrossel instagram",
    "carousel maker",
    "linkedin carousel",
    "conteúdo redes sociais ia",
    "thread visual",
    "sequencia viral",
    "export png carrossel",
  ],
  alternates: {
    canonical: "https://viral.kaleidos.com.br",
  },
  openGraph: {
    title: "Sequência Viral — Carrosséis com IA em um fluxo só",
    description:
      "Cola um link, a IA escreve com a sua voz, monta os slides e exporta PNG. Instagram, LinkedIn e X em um fluxo só.",
    type: "website",
    url: "https://viral.kaleidos.com.br",
    siteName: "Sequência Viral",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sequência Viral — Carrosséis com IA",
    description:
      "Carrossel pronto em ~60s. Voz sua, visual na sua estética, export PNG pra postar. Instagram, LinkedIn e X.",
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
    "Geração de carrosséis com IA para Instagram, X e LinkedIn. Cola um link, a IA escreve no seu tom e entrega slides prontos em ~60s. Templates Futurista + Twitter.",
  url: "https://viral.kaleidos.com.br",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Grátis",
      price: "0",
      priceCurrency: "BRL",
      description: "5 carrosséis por mês com marca d'água Sequência Viral",
    },
    {
      "@type": "Offer",
      name: "Creator",
      price: "49.90",
      priceCurrency: "BRL",
      billingIncrement: "P1M",
      description: "10 carrosséis/mês, sem marca d'água, export PNG, 1 perfil de marca (preço de lançamento, anchor R$ 99,90)",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "97.90",
      priceCurrency: "BRL",
      billingIncrement: "P1M",
      description: "30 carrosséis/mês, imagens IA + stock, cache inteligente, suporte prioritário (preço de lançamento, anchor R$ 199,90)",
    },
  ],
  featureList: [
    "IA escreve com a sua voz (DNA capturado das suas redes)",
    "2 templates visuais: Futurista (editorial) + Twitter (screenshot)",
    "Modo rápido ou modo avançado para a copy",
    "Branding com foto de perfil, @handle e paleta própria",
    "Entrada por URL, vídeo (YouTube), post Instagram/X ou texto",
    "Imagens por busca Google ou geração com IA (Imagen 4)",
    "Export em PNG otimizado para Instagram, LinkedIn e X",
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
      className={`${jakarta.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased`}
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
        <MetaPixel pixelId="1315597820451507" />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
      {GA_MEASUREMENT_ID ? <GoogleAnalytics gaId={GA_MEASUREMENT_ID} /> : null}
    </html>
  );
}
