'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(identifier, password)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message ?? '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-white tracking-tight">LazyNavy</div>
          <div className="text-slate-400 text-sm mt-1">管理后台</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">邮箱或手机号</label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="输入邮箱或手机号"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="输入密码"
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
