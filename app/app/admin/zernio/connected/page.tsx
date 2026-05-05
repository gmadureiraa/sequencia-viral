"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Movido pra /app/zernio/connected. */
export default function AdminZernioConnectedRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const qs = params?.toString() || "";
    router.replace(`/app/zernio/connected${qs ? `?${qs}` : ""}`);
  }, [router, params]);
  return null;
}
