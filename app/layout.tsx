import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { LANDING_FAQ } from "@/lib/landing-faq";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Sequência Viral — Carrosséis com IA para Instagram, LinkedIn e X",
  description:
    "Gere até 3 variações por ideia, com branding consistente e export em PNG. Um fluxo único para creators e times — do texto ao post.",
  metadataBase: new URL("https://sequencia-viral.app"),
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
    canonical: "https://sequencia-viral.app",
  },
  openGraph: {
    title: "Sequência Viral — Carrosséis com IA em um fluxo só",
    description:
      "Ideia, geração, edição e export PNG no mesmo lugar. Menos ferramentas, mais consistência para Instagram, LinkedIn e X.",
    type: "website",
    url: "https://sequencia-viral.app",
    siteName: "Sequência Viral",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sequência Viral — Carrosséis com IA",
    description:
      "Três variações por ideia, branding automático e export em PNG. Feito para quem publica em escala.",
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
    "Geração de carrosséis e threads visuais com IA para Instagram, X e LinkedIn. Três variações por ideia e export em PNG.",
  url: "https://sequencia-viral.app",
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
    "3 variações geradas por IA a partir de uma ideia",
    "Branding com foto de perfil e @handle",
    "Entrada por URL, vídeo (YouTube) ou texto",
    "Imagens sugeridas por IA ou busca",
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
        {children}
      </body>
    </html>
  );
}
