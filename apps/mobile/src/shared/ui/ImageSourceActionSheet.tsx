import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

interface Props {
  visible: boolean
  title?: string
  cameraLabel?: string
  libraryLabel?: string
  cancelLabel?: string
  onCamera: () => void
  onLibrary: () => void
  onClose: () => void
}

export function ImageSourceActionSheet({
  visible,
  title = '添加图片',
  cameraLabel = '拍照',
  libraryLabel = '从相册选择',
  cancelLabel = '取消',
  onCamera,
  onLibrary,
  onClose,
}: Props) {
  function choose(action: () => void) {
    onClose()
    requestAnimationFrame(action)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <View style={styles.group}>
            <Text style={styles.title}>{title}</Text>
            <Pressable style={styles.action} onPress={() => choose(onCamera)}>
              <Text style={styles.actionText}>{cameraLabel}</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => choose(onLibrary)}>
              <Text style={styles.actionText}>{libraryLabel}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheetWrap: { paddingHorizontal: 8, paddingBottom: 8 },
  group: { overflow: 'hidden', borderRadius: 14, backgroundColor: 'rgba(248,248,248,0.96)' },
  title: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: 'rgba(60,60,67,0.62)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  action: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  actionText: { color: '#007aff', fontSize: 20, fontWeight: '400' },
  cancel: { height: 56, marginTop: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,248,248,0.96)' },
  cancelText: { color: '#007aff', fontSize: 20, fontWeight: '700' },
})
