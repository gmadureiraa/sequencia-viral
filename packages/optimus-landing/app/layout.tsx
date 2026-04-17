import React from "react"
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { GeistPixelLine } from 'geist/font/pixel'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter'
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

export const metadata: Metadata = {
  title: 'Optimus — Build & ship with PostFlow',
  description: 'Plataforma para gerar, editar e publicar carrosséis com IA — inspirado no template Optimus (v0).',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/landing/nexus/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/landing/nexus/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/landing/nexus/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/landing/nexus/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${GeistPixelLine.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
