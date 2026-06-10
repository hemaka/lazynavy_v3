'use client'
import { useEffect, useState } from 'react'
import { listPostsAdminApi, listPoisAdminApi, type AdminPost, type AdminPoi } from '@/lib/api'

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5">
      <div className="text-slate-500 text-sm">{label}</div>
      <div className="text-3xl font-bold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-slate-400 text-xs mt-1">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [pois, setPois] = useState<AdminPoi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listPostsAdminApi(), listPoisAdminApi()])
      .then(([p, q]) => {
        setPosts(p)
        setPois(q)
      })
      .finally(() => setLoading(false))
  }, [])

  const activePosts = posts.filter(p => !p.isArchived && !p.deletedAt)
  const archivedPosts = posts.filter(p => p.isArchived)
  const activePois = pois.filter(p => p.status === 'active')

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-slate-900 mb-6">概览</h1>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          加载中…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="帖子总数" value={activePosts.length} sub={`已下架 ${archivedPosts.length}`} />
            <StatCard label="地标总数" value={activePois.length} sub="已激活" />
            <StatCard label="帖子标签数" value={[...new Set(posts.flatMap(p => p.tags))].length} />
            <StatCard label="POI 分类" value={[...new Set(pois.map(p => p.subtype))].length} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">最新帖子</h2>
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {activePosts.slice(0, 10).map(post => (
                <div key={post.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800 line-clamp-2">{post.content}</div>
                    <div className="flex gap-3 mt-1.5 text-xs text-slate-400">
                      <span>{post.author?.nickname ?? post.authorId}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                      {post.tags.length > 0 && (
                        <span className="text-sky-500">{post.tags.slice(0, 2).join(' · ')}</span>
                      )}
                    </div>
                  </div>
                  {post._count && (
                    <div className="text-xs text-slate-400 shrink-0 text-right">
                      <div>❤ {post._count.likes}</div>
                      <div>💬 {post._count.comments}</div>
                    </div>
                  )}
                </div>
              ))}
              {activePosts.length === 0 && (
                <div className="px-5 py-8 text-center text-slate-400 text-sm">暂无帖子</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
