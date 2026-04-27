import {
  DM_Serif_Display,
  Playfair_Display,
  Outfit,
  Inter,
  Source_Sans_3,
  Literata,
} from "next/font/google";
import type { ReactNode } from "react";

/**
 * Layout do editor — carrega as fontes editoriais opt-in (DM Serif,
 * Playfair, Outfit, Inter, Source Sans 3, Literata) que aparecem no
 * picker de tipografia do carrossel.
 *
 * Antes essas 6 fontes eram baixadas eager no root layout (impactando
 * LCP da landing). Agora só carregam quando o user entra em `/app/create/<id>/edit`.
 *
 * As variables (--font-dm-serif, --font-playfair, etc) batem com o que
 * `lib/editorial-fonts.ts` referencia nos stacks.
 */
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  display: "swap",
});

export default function EditLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${dmSerif.variable} ${playfair.variable} ${outfit.variable} ${inter.variable} ${sourceSans.variable} ${literata.variable}`}
    >
      {children}
    </div>
  );
}
