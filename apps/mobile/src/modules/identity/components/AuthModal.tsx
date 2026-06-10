import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTheme } from '../../../theme'
import { useAuth } from '../context'

interface Props {
  visible: boolean
  initialMode?: 'login' | 'register'
  onClose: () => void
}

export function AuthModal({ visible, initialMode = 'login', onClose }: Props) {
  const t = useTheme()
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [nickname, setNickname] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) setMode(initialMode)
  }, [initialMode, visible])

  const s = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(18,48,71,0.46)' },
    sheet: { backgroundColor: t.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: 'continuous', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 34, gap: 12 },
    handle: { width: 42, height: 4, backgroundColor: t.borderStrong, borderRadius: 99, alignSelf: 'center', marginBottom: 8 },
    title: { color: t.text, fontSize: 23, fontWeight: '900' },
    subtitle: { color: t.textDim, fontSize: 13, lineHeight: 19 },
    input: { backgroundColor: t.surfaceAlt, color: t.text, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: t.border, fontSize: 15 },
    inputError: { borderColor: t.danger },
    errorBox: { backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.22)', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    errorText: { color: t.danger, fontSize: 13 },
    primary: { backgroundColor: t.accent, borderRadius: 14, borderCurve: 'continuous', minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    primaryDisabled: { opacity: 0.58 },
    primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
    switchText: { color: t.textDim, fontSize: 13, textAlign: 'center' },
    switchLink: { color: t.accent, fontWeight: '900' },
  }), [t])

  function reset() {
    setNickname('')
    setIdentifier('')
    setPassword('')
    setFormError(null)
  }

  function close() {
    reset()
    onClose()
  }

  function showError(message: string) {
    setFormError(message)
    if (Platform.OS !== 'web') Alert.alert('提示', message)
  }

  async function submit() {
    if (!identifier.trim() || !password.trim()) {
      showError('请填写邮箱/手机号和密码')
      return
    }
    if (mode === 'register' && !nickname.trim()) {
      showError('请填写昵称')
      return
    }

    setLoading(true)
    setFormError(null)
    try {
      if (mode === 'register') await register(nickname, identifier, password)
      else await login(identifier, password)
      close()
    } catch (error: any) {
      showError(error?.message ?? (mode === 'login' ? '登录失败' : '注册失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.overlay} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{mode === 'login' ? '登录 LazyNavy' : '注册 LazyNavy'}</Text>
          <Text style={s.subtitle}>{mode === 'login' ? '登录后继续同步你的航海资料。' : '新账号会立即进入当前航海工作区。'}</Text>

          {mode === 'register' && (
            <TextInput style={[s.input, formError && s.inputError]} placeholder="昵称" placeholderTextColor={t.textSoft} value={nickname} onChangeText={(value) => { setNickname(value); if (formError) setFormError(null) }} autoCapitalize="none" />
          )}
          <TextInput style={[s.input, formError && s.inputError]} placeholder="邮箱 / 手机号" placeholderTextColor={t.textSoft} value={identifier} onChangeText={(value) => { setIdentifier(value); if (formError) setFormError(null) }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <TextInput style={[s.input, formError && s.inputError]} placeholder="密码" placeholderTextColor={t.textSoft} value={password} onChangeText={(value) => { setPassword(value); if (formError) setFormError(null) }} secureTextEntry />

          {formError && <View style={s.errorBox}><Text style={s.errorText} selectable>{formError}</Text></View>}

          <Pressable style={[s.primary, loading && s.primaryDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{mode === 'login' ? '登录' : '注册'}</Text>}
          </Pressable>

          <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); reset() }}>
            <Text style={s.switchText}>
              {mode === 'login' ? '没有账号？' : '已有账号？'}
              <Text style={s.switchLink}>{mode === 'login' ? ' 立即注册' : ' 去登录'}</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
