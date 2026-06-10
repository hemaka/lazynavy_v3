import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'LazyNavy Admin',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
