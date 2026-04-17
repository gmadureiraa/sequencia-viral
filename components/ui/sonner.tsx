"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        duration: 3500,
        className: "font-[family-name:var(--font-sans)]",
      }}
      {...props}
    />
  );
}

export { Toaster };
