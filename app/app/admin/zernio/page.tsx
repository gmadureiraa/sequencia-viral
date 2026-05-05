"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /app/admin/zernio → redirect pra /app/zernio (que agora é a localização
 * canônica). Páginas Zernio core saíram de admin path em 05/05/2026 quando
 * a feature foi liberada pra plano business (não só admin).
 *
 * /app/admin/zernio/preview-slide ainda existe (admin-only debug do renderer).
 */
export default function AdminZernioRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/zernio");
  }, [router]);
  return null;
}
