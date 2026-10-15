import { getCountries, getCountryCallingCode } from 'libphonenumber-js'

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

const toFlag = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

export const COUNTRIES = getCountries()
  .map((iso) => ({
    iso,
    name: regionNames.of(iso) ?? iso,
    dialCode: getCountryCallingCode(iso),
    flag: toFlag(iso),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const COUNTRY_BY_ISO = Object.fromEntries(COUNTRIES.map((c) => [c.iso, c]))

/** Best guess from the browser language (e.g. "vi-VN" → "VN"), falls back to US. */
export function guessDefaultCountry() {
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = lang?.split('-')[1]?.toUpperCase()
    if (region && COUNTRY_BY_ISO[region]) return region
  }
  return 'US'
}
