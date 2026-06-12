import { router } from 'expo-router'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { bottomNav, bottomNavIndexForPath } from './navConfig'

type BottomNavAnimation = 'default' | 'slide_from_left' | 'slide_from_right'

type BottomNavTransitionContextValue = {
  animation: BottomNavAnimation
  bottomNavHidden: boolean
  navigateBottomNav: (href: string, pathname: string) => void
  resetAnimation: () => void
  setBottomNavHidden: (hidden: boolean) => void
}

const BottomNavTransitionContext = createContext<BottomNavTransitionContextValue | null>(null)

export function BottomNavTransitionProvider({ children }: PropsWithChildren) {
  const [animation, setAnimation] = useState<BottomNavAnimation>('default')
  const [bottomNavHidden, setBottomNavHidden] = useState(false)

  const resetAnimation = useCallback(() => {
    setAnimation('default')
  }, [])

  const navigateBottomNav = useCallback((href: string, pathname: string) => {
    const fromIndex = bottomNavIndexForPath(pathname)
    const toIndex = bottomNav.findIndex((item) => item.href === href)

    if (fromIndex === toIndex) return

    if (fromIndex >= 0 && toIndex >= 0) {
      setAnimation(toIndex > fromIndex ? 'slide_from_right' : 'slide_from_left')
    } else {
      setAnimation('default')
    }

    setTimeout(() => {
      router.push(href as never)
    }, 0)
  }, [])

  const value = useMemo(
    () => ({ animation, bottomNavHidden, navigateBottomNav, resetAnimation, setBottomNavHidden }),
    [animation, bottomNavHidden, navigateBottomNav, resetAnimation],
  )

  return (
    <BottomNavTransitionContext.Provider value={value}>
      {children}
    </BottomNavTransitionContext.Provider>
  )
}

export function useBottomNavTransition() {
  const value = useContext(BottomNavTransitionContext)
  if (!value) throw new Error('useBottomNavTransition must be used within BottomNavTransitionProvider')
  return value
}
