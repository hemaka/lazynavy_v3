import { getJson } from '../../services/http'

export function convertUnit(value: number, from = 'nm', to = 'km') {
  return getJson<{ result: number }>(`/toolbox/units?value=${value}&from=${from}&to=${to}`)
}

export function convertCurrency(amount: number, from = 'USD', to = 'EUR') {
  return getJson<{ result: number; rateSource: string }>(`/toolbox/currency?amount=${amount}&from=${from}&to=${to}`)
}

export function getRegionInfo(code = 'US') {
  return getJson<{ name: string; vhfEmergency: string; notes: string[] }>(`/toolbox/region?code=${code}`)
}
