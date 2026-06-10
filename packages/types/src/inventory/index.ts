export type ShoppingItemStatus = 'pending' | 'bought' | 'cancelled'
export type ShoppingItemSource = 'manual' | 'low_stock' | 'ai'

export interface ShoppingItemSummary {
  id: string
  ownerId: string
  vesselId?: string | null
  voyageId?: string | null
  itemId?: string | null
  name: string
  quantity?: number | null
  unit?: string | null
  status: ShoppingItemStatus
  source: ShoppingItemSource
  sourceMessageId?: string | null
  note?: string | null
  createdAt: string
  updatedAt: string
}

export interface LowStockEntry {
  itemId: string
  name: string
  unit?: string | null
  warnBelow: number
  currentQuantity: number
  deficit: number
}

export * from './template'
