import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '../context'
import { useTheme } from '../../../theme'

type Mode = 'login' | 'register'

export function LoginScreen() {
  const t = useTheme()
  const { register, login } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [nickname, setNickname] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const s = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 42, gap: 18 },
    brand: { color: t.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    title: { color: t.text, fontSize: 30, lineHeight: 36, fontWeight: '900' },
    subtitle: { color: t.textDim, fontSize: 15, lineHeight: 22 },
    panel: { backgroundColor: t.elevated, borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, borderColor: t.border, padding: 18, gap: 12 },
    input: { backgroundColor: '#fff', color: t.text, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 15, paddingVertical: 14, borderWidth: 1, borderColor: t.border, fontSize: 15 },
    inputError: { borderColor: t.danger },
    errorBox: { backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.22)', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    errorText: { color: t.danger, fontSize: 13, lineHeight: 18 },
    primary: { backgroundColor: t.accent, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', minHeight: 50 },
    primaryDisabled: { opacity: 0.58 },
    primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    switchRow: { alignItems: 'center', paddingVertical: 4 },
    switchText: { color: t.textDim, fontSize: 14 },
    switchLink: { color: t.accent, fontWeight: '900' },
    note: { color: t.textDim, fontSize: 12, lineHeight: 18 },
  }), [t])

  function reset(nextMode?: Mode) {
    if (nextMode) setMode(nextMode)
    setNickname('')
    setIdentifier('')
    setPassword('')
    setFormError(null)
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
    } catch (error: any) {
      showError(error?.message ?? (mode === 'login' ? '登录失败' : '注册失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
          <View style={{ gap: 8 }}>
            <Text style={s.brand} selectable>LAZYNAVY</Text>
            <Text style={s.title}>{mode === 'login' ? '欢迎回来' : '加入 LazyNavy'}</Text>
            <Text style={s.subtitle}>
              {mode === 'login' ? '登录后同步你的船只、航程、地标收藏和船务资料。' : '创建账号，开始管理你的航海生活。'}
            </Text>
          </View>

          <View style={s.panel}>
            {mode === 'register' && (
              <TextInput
                style={[s.input, formError && s.inputError]}
                placeholder="昵称"
                placeholderTextColor={t.textSoft}
                value={nickname}
                onChangeText={(value) => { setNickname(value); if (formError) setFormError(null) }}
                autoCapitalize="none"
              />
            )}
            <TextInput
              style={[s.input, formError && s.inputError]}
              placeholder="邮箱 / 手机号"
              placeholderTextColor={t.textSoft}
              value={identifier}
              onChangeText={(value) => { setIdentifier(value); if (formError) setFormError(null) }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[s.input, formError && s.inputError]}
              placeholder="密码"
              placeholderTextColor={t.textSoft}
              value={password}
              onChangeText={(value) => { setPassword(value); if (formError) setFormError(null) }}
              secureTextEntry
            />

            {formError && <View style={s.errorBox}><Text style={s.errorText} selectable>{formError}</Text></View>}

            <Pressable style={[s.primary, loading && s.primaryDisabled]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{mode === 'login' ? '登录' : '注册'}</Text>}
            </Pressable>
          </View>

          <Pressable style={s.switchRow} onPress={() => reset(mode === 'login' ? 'register' : 'login')}>
            <Text style={s.switchText}>
              {mode === 'login' ? '没有账号？' : '已有账号？'}
              <Text style={s.switchLink}>{mode === 'login' ? ' 立即注册' : ' 去登录'}</Text>
            </Text>
          </Pressable>

          <Text style={s.note} selectable>当前版本使用邮箱/手机号 + 密码登录；第三方登录后续接入。</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
