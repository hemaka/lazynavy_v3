import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import ChatRoomScreen from './screens/ChatRoomScreen'
import MessagesScreen from './screens/MessagesScreen'

type ChatOverlayState = {
  openChat: () => void
  openRoom: (roomId: string) => void
  closeChat: () => void
}

const ChatOverlayContext = createContext<ChatOverlayState | null>(null)

export function ChatOverlayProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)

  const openChat = useCallback(() => {
    setRoomId(null)
    setVisible(true)
  }, [])

  const openRoom = useCallback((nextRoomId: string) => {
    setRoomId(nextRoomId)
    setVisible(true)
  }, [])

  const closeChat = useCallback(() => {
    setVisible(false)
    setRoomId(null)
  }, [])

  const value = useMemo(() => ({ openChat, openRoom, closeChat }), [closeChat, openChat, openRoom])

  return (
    <ChatOverlayContext.Provider value={value}>
      {children}
      {visible ? (
        <View style={styles.layer} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={closeChat} />
          <View style={styles.panel}>
            {roomId ? (
              <ChatRoomScreen roomIdOverride={roomId} onBack={() => setRoomId(null)} onClose={closeChat} />
            ) : (
              <MessagesScreen onOpenRoom={setRoomId} onClose={closeChat} floating />
            )}
          </View>
        </View>
      ) : null}
    </ChatOverlayContext.Provider>
  )
}

export function useChatOverlay() {
  const context = useContext(ChatOverlayContext)
  if (!context) throw new Error('useChatOverlay must be used inside ChatOverlayProvider')
  return context
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,29,54,0.28)',
  },
  panel: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
})
