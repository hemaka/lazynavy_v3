'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const NAV = [
  { href: '/dashboard', label: '概览', icon: '◎' },
  { href: '/content',   label: '内容审核', icon: '▤' },
  { href: '/users',     label: '用户管理', icon: '⊙' },
  { href: '/pois',      label: '地标管理', icon: '◈' },
  { href: '/inventory-templates', label: '物资模板', icon: '▦' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { session, logout } = useAuth()

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-slate-900 min-h-screen">
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="text-white font-bold text-base tracking-tight">LazyNavy</div>
        <div className="text-slate-500 text-xs mt-0.5">Admin</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-800">
        <div className="text-slate-400 text-xs mb-2 truncate">{session?.nickname ?? '—'}</div>
        <button
          onClick={logout}
          className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          退出登录
        </button>
      </div>
    </aside>
  )
}
