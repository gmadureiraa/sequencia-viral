import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sequência Viral — Neo-brutal (v4)",
  description: "Landing alinhada ao shell do app (docs/design/neo-brutal-app-shell).",
};

export default function LandingV4Layout({ children }: { children: ReactNode }) {
  return children;
}
