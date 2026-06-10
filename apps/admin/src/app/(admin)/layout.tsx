'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (ready && !session) router.push('/login')
  }, [ready, session, router])

  if (!ready || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
