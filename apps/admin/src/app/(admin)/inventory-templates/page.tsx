'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_GROUP_LABELS,
} from '@lazynavy-v3/types'
import {
  createInventoryTemplateApi,
  createInventoryTemplateItemApi,
  deleteInventoryTemplateApi,
  deleteInventoryTemplateItemApi,
  listInventoryTemplateItemsApi,
  listInventoryTemplatesApi,
  updateInventoryTemplateApi,
  updateInventoryTemplateItemApi,
  type AdminInventoryTemplate,
  type AdminInventoryTemplateItem,
} from '@/lib/api'

const GROUP_OPTIONS = Object.entries(INVENTORY_GROUP_LABELS)

function metadataString(item: AdminInventoryTemplateItem, key: string) {
  const value = item.metadata?.[key]
  return typeof value === 'string' ? value : ''
}

function labelCategory(key?: string | null) {
  return key ? INVENTORY_CATEGORY_LABELS[key] ?? key : '未分类'
}

function labelGroup(key?: string | null) {
  return key ? INVENTORY_GROUP_LABELS[key] ?? key : '未分组'
}

export default function InventoryTemplatesPage() {
  const [templates, setTemplates] = useState<AdminInventoryTemplate[]>([])
  const [items, setItems] = useState<AdminInventoryTemplateItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newTemplate, setNewTemplate] = useState({ id: '', name: '', locale: 'en' })
  const [newItem, setNewItem] = useState({ category: 'food', groupKey: 'protein', name: '', unit: '', warnBelow: '0', templateKey: '' })

  const selected = templates.find(t => t.id === selectedId)
  const groupedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const c = String(a.category ?? '').localeCompare(String(b.category ?? ''))
      if (c !== 0) return c
      return metadataString(a, 'groupKey').localeCompare(metadataString(b, 'groupKey')) || a.name.localeCompare(b.name)
    })
  }, [items])

  async function load(nextSelectedId?: string) {
    setError('')
    setLoading(true)
    try {
      const nextTemplates = await listInventoryTemplatesApi()
      setTemplates(nextTemplates)
      const target = nextSelectedId || selectedId || nextTemplates[0]?.id || ''
      setSelectedId(target)
      setItems(target ? await listInventoryTemplateItemsApi(target) : [])
    } catch (err: any) {
      setError(err.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function selectTemplate(id: string) {
    setSelectedId(id)
    setItems(await listInventoryTemplateItemsApi(id))
  }

  async function saveTemplate() {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await updateInventoryTemplateApi(selected.id, {
        name: selected.name,
        description: selected.description ?? '',
      })
      setTemplates(current => current.map(t => t.id === updated.id ? updated : t))
    } finally {
      setSaving(false)
    }
  }

  async function addTemplate() {
    if (!newTemplate.name.trim()) return
    setSaving(true)
    try {
      const created = await createInventoryTemplateApi({
        id: newTemplate.id.trim() || undefined,
        name: newTemplate.name.trim(),
        locale: newTemplate.locale.trim() || 'en',
      })
      setNewTemplate({ id: '', name: '', locale: 'en' })
      await load(created.id)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(id: string) {
    if (!window.confirm('删除这个模板船？默认模板不能删除。')) return
    await deleteInventoryTemplateApi(id)
    await load()
  }

  async function addItem() {
    if (!selectedId || !newItem.name.trim()) return
    setSaving(true)
    try {
      await createInventoryTemplateItemApi(selectedId, {
        category: newItem.category,
        groupKey: newItem.groupKey,
        name: newItem.name.trim(),
        unit: newItem.unit.trim() || undefined,
        warnBelow: Number(newItem.warnBelow || 0),
        templateKey: newItem.templateKey.trim() || undefined,
      })
      setNewItem(current => ({ ...current, name: '', unit: '', warnBelow: '0', templateKey: '' }))
      setItems(await listInventoryTemplateItemsApi(selectedId))
    } finally {
      setSaving(false)
    }
  }

  async function patchItem(id: string, patch: Partial<AdminInventoryTemplateItem> & { groupKey?: string; templateKey?: string }) {
    const updated = await updateInventoryTemplateItemApi(id, {
      category: patch.category ?? undefined,
      groupKey: patch.groupKey,
      name: patch.name ?? undefined,
      unit: patch.unit ?? undefined,
      warnBelow: patch.warnBelow ?? undefined,
      status: patch.status ?? undefined,
      templateKey: patch.templateKey,
    })
    setItems(current => current.map(item => item.id === id ? updated : item))
  }

  async function deleteItem(id: string) {
    if (!window.confirm('删除这个模板物资？之后新建船只不会再复制它。')) return
    await deleteInventoryTemplateItemApi(id)
    setItems(current => current.filter(item => item.id !== id))
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">物资模板</h1>
          <div className="text-slate-400 text-sm mt-0.5">模板船保存在系统用户下，新建船只会复制默认模板的物资</div>
        </div>
        <button
          onClick={() => void load(selectedId)}
          className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          刷新
        </button>
      </div>

      {error && <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">{error}</div>}

      <div className="grid grid-cols-[300px_1fr] gap-6">
        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">模板船</div>
            {loading ? (
              <div className="px-5 py-8 text-sm text-slate-400">加载中…</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => void selectTemplate(template.id)}
                    className={`w-full text-left px-5 py-4 hover:bg-slate-50 ${selectedId === template.id ? 'bg-sky-50' : ''}`}
                  >
                    <div className="font-medium text-slate-800">{template.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-1">{template.id}</div>
                    <div className="text-xs text-slate-500 mt-1">{template._count?.items ?? 0} 个物资项</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="font-semibold text-slate-800">新建模板船</div>
            <input value={newTemplate.id} onChange={e => setNewTemplate(v => ({ ...v, id: e.target.value }))} placeholder="template_02_zh" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={newTemplate.name} onChange={e => setNewTemplate(v => ({ ...v, name: e.target.value }))} placeholder="模板名称" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={newTemplate.locale} onChange={e => setNewTemplate(v => ({ ...v, locale: e.target.value }))} placeholder="locale" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <button disabled={saving || !newTemplate.name.trim()} onClick={() => void addTemplate()} className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40">创建</button>
          </div>
        </aside>

        <main className="space-y-4">
          {selected && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <label className="text-xs text-slate-500">
                  名称
                  <input value={selected.name} onChange={e => setTemplates(current => current.map(t => t.id === selected.id ? { ...t, name: e.target.value } : t))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800" />
                </label>
                <label className="text-xs text-slate-500">
                  描述
                  <input value={selected.description ?? ''} onChange={e => setTemplates(current => current.map(t => t.id === selected.id ? { ...t, description: e.target.value } : t))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800" />
                </label>
                <div className="flex gap-2">
                  <button disabled={saving} onClick={() => void saveTemplate()} className="bg-sky-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40">保存模板</button>
                  {selected.id !== 'template_01_en' && (
                    <button onClick={() => void deleteTemplate(selected.id)} className="bg-red-50 text-red-600 rounded-lg px-4 py-2 text-sm">删除</button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="font-semibold text-slate-800 mb-4">添加模板物资</div>
            <div className="grid grid-cols-[140px_160px_1fr_90px_90px_140px_auto] gap-3">
              <select value={newItem.category} onChange={e => setNewItem(v => ({ ...v, category: e.target.value }))} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {INVENTORY_CATEGORIES.map(key => <option key={key} value={key}>{labelCategory(key)}</option>)}
              </select>
              <select value={newItem.groupKey} onChange={e => setNewItem(v => ({ ...v, groupKey: e.target.value }))} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {GROUP_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input value={newItem.name} onChange={e => setNewItem(v => ({ ...v, name: e.target.value }))} placeholder="名称" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={newItem.unit} onChange={e => setNewItem(v => ({ ...v, unit: e.target.value }))} placeholder="单位" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={newItem.warnBelow} onChange={e => setNewItem(v => ({ ...v, warnBelow: e.target.value.replace(/[^\d.]/g, '') }))} placeholder="最低" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={newItem.templateKey} onChange={e => setNewItem(v => ({ ...v, templateKey: e.target.value }))} placeholder="templateKey" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <button disabled={saving || !selectedId || !newItem.name.trim()} onClick={() => void addItem()} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40">添加</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">分类</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">分组</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">名称</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">单位</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">最低</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">templateKey</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedItems.map(item => {
                  const groupKey = metadataString(item, 'groupKey') || metadataString(item, 'category2')
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <select value={item.category ?? ''} onChange={e => void patchItem(item.id, { category: e.target.value })} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                          {INVENTORY_CATEGORIES.map(key => <option key={key} value={key}>{labelCategory(key)}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={groupKey} onChange={e => void patchItem(item.id, { groupKey: e.target.value })} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                          {GROUP_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input defaultValue={item.name} onBlur={e => e.target.value !== item.name && void patchItem(item.id, { name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input defaultValue={item.unit ?? ''} onBlur={e => e.target.value !== (item.unit ?? '') && void patchItem(item.id, { unit: e.target.value })} className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input defaultValue={String(item.warnBelow ?? 0)} onBlur={e => Number(e.target.value || 0) !== (item.warnBelow ?? 0) && void patchItem(item.id, { warnBelow: Number(e.target.value || 0) })} className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input defaultValue={metadataString(item, 'templateKey')} onBlur={e => e.target.value !== metadataString(item, 'templateKey') && void patchItem(item.id, { templateKey: e.target.value })} className="w-44 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => void deleteItem(item.id)} className="text-red-500 hover:text-red-700 text-xs">删除</button>
                      </td>
                    </tr>
                  )
                })}
                {groupedItems.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">暂无模板物资</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
