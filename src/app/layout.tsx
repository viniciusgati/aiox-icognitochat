import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IcognitoChat',
  description: 'Chat anônimo e privado, sem contas permanentes',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'IcognitoChat',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-900 text-slate-100 min-h-screen overscroll-none">
        {children}
      </body>
    </html>
  )
}
