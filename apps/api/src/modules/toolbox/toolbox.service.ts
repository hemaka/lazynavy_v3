import { BadRequestException, Injectable } from '@nestjs/common'

const UNIT_FACTORS: Record<string, number> = {
  nm: 1852,
  km: 1000,
  mi: 1609.344,
  m: 1,
  ft: 0.3048,
  l: 1,
  gal: 3.785411784,
}

const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.37,
  AUD: 1.52,
  CNY: 7.24,
}

const REGION_INFO: Record<string, { name: string; vhfEmergency: string; notes: string[] }> = {
  US: { name: 'United States', vhfEmergency: 'VHF 16', notes: ['Use NOAA marine weather channels where available.', 'Carry locally required safety equipment.'] },
  CA: { name: 'Canada', vhfEmergency: 'VHF 16', notes: ['Check Transport Canada carriage requirements.', 'Monitor local Coast Guard notices.'] },
  EU: { name: 'European Union', vhfEmergency: 'VHF 16', notes: ['Check country-specific inland/coastal rules.', 'Carry ICC/registration documents when required.'] },
}

@Injectable()
export class ToolboxService {
  convertUnit(value: number, from: string, to: string) {
    const fromFactor = UNIT_FACTORS[from.toLowerCase()]
    const toFactor = UNIT_FACTORS[to.toLowerCase()]
    if (!Number.isFinite(value) || !fromFactor || !toFactor) throw new BadRequestException('Unsupported unit conversion')
    return { value, from, to, result: value * fromFactor / toFactor }
  }

  convertCurrency(amount: number, from: string, to: string) {
    const source = USD_RATES[from.toUpperCase()]
    const target = USD_RATES[to.toUpperCase()]
    if (!Number.isFinite(amount) || !source || !target) throw new BadRequestException('Unsupported currency conversion')
    const usd = amount / source
    return { amount, from: from.toUpperCase(), to: to.toUpperCase(), result: usd * target, rateSource: 'static-default' }
  }

  region(code: string) {
    const key = code.toUpperCase()
    return REGION_INFO[key] ?? { name: key, vhfEmergency: 'VHF 16', notes: ['Check local maritime authority rules before departure.'] }
  }
}
