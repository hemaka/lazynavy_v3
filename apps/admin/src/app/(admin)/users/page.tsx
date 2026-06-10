'use client'
import { useEffect, useState } from 'react'
import { listUsersApi, type AdminUser } from '@/lib/api'

const ROLE_LABEL: Record<string, string> = {
  CREW: '船员',
  CAPTAIN: '船长',
  OWNER: '船主',
  MERCHANT: '商家',
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    listUsersApi()
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(
    u => !q || u.nickname.includes(q) || u.email?.includes(q) || u.phone?.includes(q),
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">用户管理</h1>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜索昵称或邮箱…"
          className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm w-64 outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          加载中…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
          {error}
          <div className="text-red-400 text-xs mt-1">
            需要在 API 添加 GET /users/admin/list 端点
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">用户</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">联系方式</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">角色</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">注册时间</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-800">{user.nickname}</div>
                    <div className="text-slate-400 text-xs font-mono">{user.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {user.email ?? user.phone ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0
                        ? user.roles.map(r => (
                            <span
                              key={r}
                              className="bg-sky-50 text-sky-700 text-xs px-2 py-0.5 rounded-full"
                            >
                              {ROLE_LABEL[r] ?? r}
                            </span>
                          ))
                        : <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-5 py-3">
                    {user.deletedAt ? (
                      <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">已注销</span>
                    ) : (
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">正常</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
