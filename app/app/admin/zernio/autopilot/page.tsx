"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Movido pra /app/zernio/autopilot (admin + plano business). */
export default function AdminZernioAutopilotRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/zernio/autopilot");
  }, [router]);
  return null;
}
