"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Movido pra /app/zernio/calendar (todos os planos podem ver). */
export default function AdminZernioCalendarRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/zernio/calendar");
  }, [router]);
  return null;
}
