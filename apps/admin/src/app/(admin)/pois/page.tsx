'use client'
import { useEffect, useState } from 'react'
import { listPoisAdminApi, type AdminPoi } from '@/lib/api'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:   { label: '正常', cls: 'bg-emerald-50 text-emerald-700' },
  inactive: { label: '下线', cls: 'bg-slate-100 text-slate-500' },
  pending:  { label: '待审', cls: 'bg-amber-50 text-amber-700' },
}

export default function PoisPage() {
  const [pois, setPois] = useState<AdminPoi[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    listPoisAdminApi()
      .then(setPois)
      .finally(() => setLoading(false))
  }, [])

  const filtered = pois.filter(p => {
    const matchQ = !q || p.name.includes(q) || p.country?.includes(q) || p.region?.includes(q)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchQ && matchStatus
  })

  const subtypes = [...new Set(pois.map(p => p.subtype))].sort()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">地标管理</h1>
          <div className="text-slate-400 text-sm mt-0.5">共 {pois.length} 个地标</div>
        </div>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="inactive">下线</option>
            <option value="pending">待审</option>
          </select>
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜索地标名称或地区…"
            className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm w-64 outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setQ('')}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-3 py-1 transition-colors"
        >
          全部类型
        </button>
        {subtypes.map(st => (
          <button
            key={st}
            onClick={() => setQ(st)}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-3 py-1 transition-colors"
          >
            {st}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">名称</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">类型</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">地区</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">坐标</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">评分</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(poi => {
                const s = STATUS_LABEL[poi.status] ?? { label: poi.status, cls: 'bg-slate-100 text-slate-500' }
                return (
                  <tr key={poi.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{poi.name}</div>
                      <div className="text-slate-400 text-xs">{poi.subtype}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{poi.kind}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {[poi.region, poi.country].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs font-mono">
                      {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
                    </td>
                    <td className="px-5 py-3">
                      {poi.rating != null ? (
                        <span className="text-amber-500">★ {poi.rating.toFixed(1)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    暂无地标
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
