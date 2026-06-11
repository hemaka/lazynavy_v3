import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

export interface CountryRegionValue {
  country: string
  region: string
}

interface CountryOption {
  code: string
  label: string
  regions?: string[]
}

interface Props {
  visible: boolean
  country?: string | null
  region?: string | null
  onClose: () => void
  onChange: (value: CountryRegionValue) => void
}

const COUNTRIES: CountryOption[] = [
  { code: 'CN', label: '中国', regions: ['北京市', '上海市', '天津市', '重庆市', '广东省', '浙江省', '江苏省', '福建省', '山东省', '海南省', '香港', '澳门', '台湾'] },
  { code: 'US', label: '美国', regions: ['California', 'Florida', 'New York', 'Texas', 'Washington', 'Hawaii', 'Alaska', 'New Jersey', 'Massachusetts', 'Illinois'] },
  { code: 'CA', label: '加拿大', regions: ['British Columbia', 'Ontario', 'Quebec', 'Nova Scotia', 'Alberta', 'Manitoba'] },
  { code: 'GB', label: '英国', regions: ['England', 'Scotland', 'Wales', 'Northern Ireland'] },
  { code: 'AU', label: '澳大利亚', regions: ['New South Wales', 'Queensland', 'Victoria', 'Western Australia', 'South Australia', 'Tasmania'] },
  { code: 'NZ', label: '新西兰', regions: ['Auckland', 'Wellington', 'Canterbury', 'Otago', 'Waikato'] },
  { code: 'JP', label: '日本', regions: ['Tokyo', 'Kanagawa', 'Osaka', 'Hyogo', 'Fukuoka', 'Okinawa', 'Hokkaido'] },
  { code: 'KR', label: '韩国', regions: ['Seoul', 'Busan', 'Incheon', 'Jeju'] },
  { code: 'SG', label: '新加坡' },
  { code: 'MY', label: '马来西亚', regions: ['Johor', 'Kuala Lumpur', 'Penang', 'Sabah', 'Sarawak'] },
  { code: 'TH', label: '泰国', regions: ['Bangkok', 'Phuket', 'Chonburi', 'Krabi', 'Surat Thani'] },
  { code: 'PH', label: '菲律宾', regions: ['Metro Manila', 'Cebu', 'Palawan', 'Batangas', 'Davao'] },
  { code: 'ID', label: '印度尼西亚', regions: ['Bali', 'Jakarta', 'Riau Islands', 'East Java', 'West Nusa Tenggara'] },
  { code: 'VN', label: '越南', regions: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Khanh Hoa', 'Quang Ninh'] },
  { code: 'FR', label: '法国', regions: ['Brittany', 'Normandy', 'Provence-Alpes-Cote d’Azur', 'Corsica', 'Occitanie'] },
  { code: 'DE', label: '德国', regions: ['Bavaria', 'Hamburg', 'Lower Saxony', 'Schleswig-Holstein', 'Berlin'] },
  { code: 'IT', label: '意大利', regions: ['Liguria', 'Tuscany', 'Sicily', 'Sardinia', 'Veneto', 'Lazio'] },
  { code: 'ES', label: '西班牙', regions: ['Catalonia', 'Andalusia', 'Balearic Islands', 'Canary Islands', 'Valencia'] },
  { code: 'PT', label: '葡萄牙', regions: ['Lisbon', 'Algarve', 'Madeira', 'Azores', 'Porto'] },
  { code: 'NL', label: '荷兰', regions: ['North Holland', 'South Holland', 'Zeeland', 'Friesland'] },
  { code: 'NO', label: '挪威', regions: ['Oslo', 'Vestland', 'Rogaland', 'Troms', 'Nordland'] },
  { code: 'SE', label: '瑞典', regions: ['Stockholm', 'Vastra Gotaland', 'Skane'] },
  { code: 'DK', label: '丹麦', regions: ['Capital Region', 'Central Denmark', 'Southern Denmark'] },
  { code: 'GR', label: '希腊', regions: ['Attica', 'South Aegean', 'Crete', 'Ionian Islands'] },
  { code: 'TR', label: '土耳其', regions: ['Istanbul', 'Antalya', 'Mugla', 'Izmir'] },
  { code: 'AE', label: '阿联酋', regions: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah'] },
  { code: 'MX', label: '墨西哥', regions: ['Baja California', 'Quintana Roo', 'Jalisco', 'Mexico City'] },
  { code: 'BR', label: '巴西', regions: ['Rio de Janeiro', 'Sao Paulo', 'Bahia', 'Santa Catarina'] },
  { code: 'CL', label: '智利', regions: ['Valparaiso', 'Los Lagos', 'Magallanes', 'Santiago'] },
  { code: 'ZA', label: '南非', regions: ['Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Gauteng'] },
  { code: 'OTHER', label: '其他国家或地区' },
]

export function CountryRegionPicker({ visible, country, region, onClose, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(country || '')
  const [selectedRegion, setSelectedRegion] = useState(region || '')

  useEffect(() => {
    if (!visible) return
    setQuery('')
    setSelectedCountry(country || '')
    setSelectedRegion(region || '')
  }, [country, region, visible])

  const countryOptions = useMemo(() => {
    const clean = query.trim().toLowerCase()
    if (!clean) return COUNTRIES
    return COUNTRIES.filter((item) => item.label.toLowerCase().includes(clean) || item.code.toLowerCase().includes(clean) || item.regions?.some((r) => r.toLowerCase().includes(clean)))
  }, [query])

  const activeCountry = COUNTRIES.find((item) => item.label === selectedCountry) ?? COUNTRIES.find((item) => item.label === country)
  const regions = activeCountry?.regions ?? []

  function selectCountry(item: CountryOption) {
    setSelectedCountry(item.label)
    setSelectedRegion('')
  }

  function save(countryValue = selectedCountry, regionValue = selectedRegion) {
    onChange({ country: countryValue, region: regionValue })
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.nav}>
          <Pressable style={styles.navButton} onPress={onClose}>
            <Text style={styles.navText}>取消</Text>
          </Pressable>
          <Text style={styles.navTitle}>国家和地区</Text>
          <Pressable style={styles.navButton} onPress={() => save()}>
            <Text style={styles.doneText}>完成</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <TextInput value={query} onChangeText={setQuery} placeholder="搜索国家、地区" placeholderTextColor="rgba(60,60,67,0.46)" style={styles.searchInput} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>国家或地区</Text>
          <View style={styles.group}>
            {countryOptions.map((item) => {
              const active = selectedCountry === item.label
              return (
                <Pressable key={item.code} style={styles.row} onPress={() => selectCountry(item)}>
                  <Text style={styles.rowTitle}>{item.label}</Text>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowMeta}>{item.code}</Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                </Pressable>
              )
            })}
          </View>

          {selectedCountry ? (
            <>
              <Text style={styles.sectionTitle}>地区</Text>
              <View style={styles.group}>
                <Pressable style={styles.row} onPress={() => save(selectedCountry, '')}>
                  <Text style={styles.rowTitle}>不设置地区</Text>
                  {!selectedRegion ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
                {regions.map((item) => {
                  const active = selectedRegion === item
                  return (
                    <Pressable key={item} style={styles.row} onPress={() => save(selectedCountry, item)}>
                      <Text style={styles.rowTitle}>{item}</Text>
                      {active ? <Text style={styles.check}>✓</Text> : null}
                    </Pressable>
                  )
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f2f7' },
  nav: {
    height: 104,
    paddingTop: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(248,248,248,0.96)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(60,60,67,0.2)',
  },
  navButton: { minWidth: 58, height: 40, justifyContent: 'center' },
  navText: { color: '#007aff', fontSize: 17, fontWeight: '400' },
  doneText: { color: '#007aff', fontSize: 17, fontWeight: '700', textAlign: 'right' },
  navTitle: { color: '#111', fontSize: 17, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: { height: 38, borderRadius: 10, paddingHorizontal: 12, color: '#111', backgroundColor: 'rgba(118,118,128,0.16)', fontSize: 16 },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 44 },
  sectionTitle: { marginTop: 12, marginBottom: 7, paddingHorizontal: 16, color: 'rgba(60,60,67,0.68)', fontSize: 13, fontWeight: '400' },
  group: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 0.5, borderColor: 'rgba(60,60,67,0.12)' },
  row: {
    minHeight: 50,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  rowTitle: { flex: 1, color: '#111', fontSize: 16, fontWeight: '400' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowMeta: { color: 'rgba(60,60,67,0.52)', fontSize: 13, fontWeight: '500' },
  check: { minWidth: 20, color: '#007aff', fontSize: 18, fontWeight: '700', textAlign: 'right' },
})
