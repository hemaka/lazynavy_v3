'use client'
import { useEffect, useState } from 'react'
import {
  listPostsAdminApi,
  archivePostAdminApi,
  deletePostAdminApi,
  type AdminPost,
} from '@/lib/api'

type Tab = 'active' | 'archived'

export default function ContentPage() {
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('active')
  const [q, setQ] = useState('')

  useEffect(() => {
    setLoading(true)
    listPostsAdminApi()
      .then(setPosts)
      .finally(() => setLoading(false))
  }, [])

  async function handleArchive(id: string) {
    await archivePostAdminApi(id)
    setPosts(prev => prev.map(p => (p.id === id ? { ...p, isArchived: true } : p)))
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除该帖子？此操作不可恢复。')) return
    await deletePostAdminApi(id)
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  const filtered = posts
    .filter(p => (tab === 'active' ? !p.isArchived && !p.deletedAt : p.isArchived))
    .filter(p => !q || p.content.includes(q) || p.author?.nickname?.includes(q))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">内容审核</h1>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜索帖子内容或作者…"
          className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm w-64 outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      <div className="flex gap-1 mb-5">
        {(['active', 'archived'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t ? 'bg-sky-500 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'active' ? '正常' : '已下架'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {filtered.map(post => (
            <div key={post.id} className="flex items-start gap-4 px-5 py-4">
              {post.media?.[0] && (
                <img
                  src={post.media[0].url}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-100"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-800 line-clamp-2">{post.content}</div>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
                  <span>{post.author?.nickname ?? post.authorId}</span>
                  <span>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                  {post.tags.map(tag => (
                    <span key={tag} className="text-sky-500">#{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {!post.isArchived && (
                  <button
                    onClick={() => handleArchive(post.id)}
                    className="text-xs text-slate-500 hover:text-amber-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    下架
                  </button>
                )}
                <button
                  onClick={() => handleDelete(post.id)}
                  className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-slate-400 text-sm">暂无内容</div>
          )}
        </div>
      )}
    </div>
  )
}
