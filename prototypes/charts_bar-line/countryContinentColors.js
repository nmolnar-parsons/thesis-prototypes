/** Stable continent palettes + per-country colors (identical hex across visuals). */

export const JAPAN_RED = '#d32f2f'

export const CONTINENT_COLORS = {
  Asia: ['#ef9a9a', '#ef5350', '#e53935', '#c62828', '#b71c1c'],
  Europe: ['#c8e6c9', '#81c784', '#4caf50', '#2e7d32', '#1b5e20'],
  Americas: ['#bbdefb', '#64b5f6', '#1e88e5', '#1565c0', '#0d47a1'],
  Africa: ['#ffe0b2', '#ffb74d', '#fb8c00', '#ef6c00', '#e65100'],
  Oceania: ['#f8bbd0', '#f48fb1', '#ec407a', '#d81b60', '#ad1457'],
  Other: ['#e5e7eb', '#cbd5e1', '#94a3b8', '#64748b', '#475569'],
}

/** Display order for continent legends (matches hue groups above). */
export const CONTINENT_ORDER = ['Asia', 'Europe', 'Americas', 'Africa', 'Oceania', 'Other']

export function continentLegendSwatch(continent) {
  const palette = CONTINENT_COLORS[continent] || CONTINENT_COLORS.Other
  return palette[Math.min(2, palette.length - 1)]
}

/** Canonical country name -> continent (one row per country). */
export const CANONICAL_COUNTRY_TO_CONTINENT = {
  Afghanistan: 'Asia',
  Albania: 'Europe',
  Algeria: 'Africa',
  Angola: 'Africa',
  Argentina: 'Americas',
  Australia: 'Oceania',
  Austria: 'Europe',
  Barbados: 'Americas',
  Belize: 'Americas',
  Benin: 'Africa',
  Bermuda: 'Americas',
  Brazil: 'Americas',
  'Cabo Verde': 'Africa',
  Cambodia: 'Asia',
  Canada: 'Americas',
  'Cayman Islands': 'Americas',
  Chile: 'Americas',
  China: 'Asia',
  Colombia: 'Americas',
  Congo: 'Africa',
  'Cook Islands': 'Oceania',
  'Costa Rica': 'Americas',
  Cuba: 'Americas',
  Curaçao: 'Americas',
  "Côte d'Ivoire": 'Africa',
  Dominica: 'Americas',
  'Dominican Republic': 'Americas',
  Denmark: 'Europe',
  Ecuador: 'Americas',
  Egypt: 'Africa',
  'El Salvador': 'Americas',
  'Equatorial Guinea': 'Africa',
  'Faroe Islands': 'Europe',
  Fiji: 'Oceania',
  France: 'Europe',
  'French Polynesia': 'Oceania',
  Gabon: 'Africa',
  Gambia: 'Africa',
  Germany: 'Europe',
  Georgia: 'Asia',
  Ghana: 'Africa',
  Gibraltar: 'Europe',
  Greece: 'Europe',
  Grenada: 'Americas',
  Guatemala: 'Americas',
  Guinea: 'Africa',
  Guyana: 'Americas',
  Honduras: 'Americas',
  Iceland: 'Europe',
  India: 'Asia',
  Indonesia: 'Asia',
  Israel: 'Asia',
  Italy: 'Europe',
  Jamaica: 'Americas',
  Japan: 'Asia',
  Kiribati: 'Oceania',
  Croatia: 'Europe',
  Cyprus: 'Asia',
  'South Korea': 'Asia',
  Liberia: 'Africa',
  Libya: 'Africa',
  Maldives: 'Asia',
  Malta: 'Europe',
  'Marshall Islands': 'Oceania',
  Mauritania: 'Africa',
  Mexico: 'Americas',
  'Micronesia, Federated States of': 'Oceania',
  Morocco: 'Africa',
  Namibia: 'Africa',
  Nauru: 'Oceania',
  'New Zealand': 'Oceania',
  Nicaragua: 'Americas',
  Nigeria: 'Africa',
  Niue: 'Oceania',
  Norway: 'Europe',
  Palau: 'Oceania',
  'Palestine, State of': 'Asia',
  Panama: 'Americas',
  'Papua New Guinea': 'Oceania',
  Peru: 'Americas',
  Philippines: 'Asia',
  Portugal: 'Europe',
  'Russian Federation': 'Europe',
  'Saint Helena, Ascension and Tristan da Cunha': 'Africa',
  'Saint Kitts and Nevis': 'Americas',
  'Saint Lucia': 'Americas',
  'Saint Pierre and Miquelon': 'Americas',
  'Saint Vincent and the Grenadines': 'Americas',
  Samoa: 'Oceania',
  'Sao Tome and Principe': 'Africa',
  Senegal: 'Africa',
  Serbia: 'Europe',
  Seychelles: 'Africa',
  'Sierra Leone': 'Africa',
  Singapore: 'Asia',
  'Solomon Islands': 'Oceania',
  'South Africa': 'Africa',
  Spain: 'Europe',
  'Sri Lanka': 'Asia',
  Suriname: 'Americas',
  'Syrian Arab Republic': 'Asia',
  Taiwan: 'Asia',
  Thailand: 'Asia',
  Tokelau: 'Oceania',
  Togo: 'Africa',
  Tonga: 'Oceania',
  'Trinidad and Tobago': 'Americas',
  Tunisia: 'Africa',
  Turkey: 'Europe',
  Turkmenistan: 'Asia',
  'Turks and Caicos Islands': 'Americas',
  Tuvalu: 'Oceania',
  Ukraine: 'Europe',
  'United Kingdom': 'Europe',
  'United States': 'Americas',
  Uruguay: 'Americas',
  Vanuatu: 'Oceania',
  'Venezuela, Bolivarian Republic of': 'Americas',
  Vietnam: 'Asia',
  'Virgin Islands, British': 'Americas',
  'Wallis and Futuna': 'Oceania',
}

/** Lowercased canonical label -> canonical key (matches NOAA-style ALL CAPS and other casing). */
const LOWER_KEY_TO_CANONICAL = Object.freeze(
  Object.fromEntries(Object.keys(CANONICAL_COUNTRY_TO_CONTINENT).map((k) => [k.toLowerCase(), k]))
)

/** Normalized alias string -> canonical name (keys must be normalizeCountry output, lowercased for lookup). */
const ALIAS_LOWER_TO_CANONICAL = {
  korea: 'South Korea',
  'south korea': 'South Korea',
  'korea, republic of': 'South Korea',
  'republic of korea': 'South Korea',
  vietnam: 'Vietnam',
  'viet nam': 'Vietnam',
  taiwan: 'Taiwan',
  'taiwan, province of china': 'Taiwan',
  'taiwan province of china': 'Taiwan',
  turkey: 'Turkey',
  türkiye: 'Turkey',
  usa: 'United States',
  'united states of america': 'United States',
  'sri lanka': 'Sri Lanka',
  sri_lanka: 'Sri Lanka',
  russia: 'Russian Federation',
  uk: 'United Kingdom',
  'great britain': 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  'ivory coast': "Côte d'Ivoire",
  'cote divoire': "Côte d'Ivoire",
  curacao: 'Curaçao',
  'saint vincent and the grenadines': 'Saint Vincent and the Grenadines',
  'st vincent and the grenadines': 'Saint Vincent and the Grenadines',
  'saint kitts and nevis': 'Saint Kitts and Nevis',
  'st kitts and nevis': 'Saint Kitts and Nevis',
  'saint lucia': 'Saint Lucia',
  'st lucia': 'Saint Lucia',
  'micronesia (federated states of)': 'Micronesia, Federated States of',
  venezuela: 'Venezuela, Bolivarian Republic of',
  'venezuela bolivarian republic of': 'Venezuela, Bolivarian Republic of',
  turkiye: 'Turkey',
  'cook is': 'Cook Islands',
  'marshall is': 'Marshall Islands',
  'maldive is': 'Maldives',
  'st vincent grenadine': 'Saint Vincent and the Grenadines',
  'tokelau is': 'Tokelau',
  'western samoa': 'Samoa',
}

export const COUNTRY_COLOR_OVERRIDES = {
  Unreported: '#64748b',
  'South Africa': '#fb8c00',
  Australia: '#ec407a',
  'New Zealand': '#f48fb1',
  Norway: '#16a34a',
}

export function normalizeCountry(country) {
  return String(country)
    .replace(/\./g, ' ')
    .replace(/&/g, ' and ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolveCanonicalCountry(country) {
  if (country == null || country === '') return null
  const n = normalizeCountry(country)
  if (!n) return null
  if (Object.prototype.hasOwnProperty.call(CANONICAL_COUNTRY_TO_CONTINENT, n)) return n
  const underscored = n.replace(/\s+/g, '_')
  if (Object.prototype.hasOwnProperty.call(CANONICAL_COUNTRY_TO_CONTINENT, underscored)) {
    return n.replace(/_/g, ' ')
  }
  const canonFromLower = LOWER_KEY_TO_CANONICAL[n.toLowerCase()]
  if (canonFromLower) return canonFromLower
  const lower = n.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(ALIAS_LOWER_TO_CANONICAL, lower)) {
    return ALIAS_LOWER_TO_CANONICAL[lower]
  }
  const lowerUnder = underscored.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(ALIAS_LOWER_TO_CANONICAL, lowerUnder)) {
    return ALIAS_LOWER_TO_CANONICAL[lowerUnder]
  }
  return null
}

export function getContinent(country) {
  const canon = resolveCanonicalCountry(country)
  if (!canon) return 'Other'
  return CANONICAL_COUNTRY_TO_CONTINENT[canon] || 'Other'
}

function continentPaletteForSubset(continent, avoidPastels) {
  const base = CONTINENT_COLORS[continent] || CONTINENT_COLORS.Other
  if (avoidPastels && base.length > 3) return base.slice(1)
  return base
}

/**
 * Colors for a fixed set of country names (e.g. all countries shown in District Donuts).
 * Spreads each continent's subset across its palette; optional trim drops the lightest swatch for legibility.
 */
export function buildCountryColorMapForSubset(countryNames, { avoidPastels = true } = {}) {
  const map = new Map()
  const seen = new Set()
  const entries = []
  for (const raw of countryNames) {
    if (raw == null || raw === '') continue
    const norm = normalizeCountry(raw)
    if (!norm) continue
    const canon = resolveCanonicalCountry(raw)
    const key = canon ?? norm
    if (seen.has(key)) continue
    seen.add(key)
    const continent = getContinent(raw)
    entries.push({ key, canon, norm, continent })
  }

  function excludedFromSpread({ canon, norm }) {
    if (canon === 'Japan' || norm.toLowerCase() === 'japan') return true
    if (canon && COUNTRY_COLOR_OVERRIDES[canon]) return true
    return false
  }

  const byContinent = new Map()
  for (const e of entries) {
    if (excludedFromSpread(e)) continue
    const list = byContinent.get(e.continent) || []
    list.push(e.key)
    byContinent.set(e.continent, list)
  }

  for (const [continent, names] of byContinent.entries()) {
    names.sort((a, b) => a.localeCompare(b, 'en'))
    const palette = continentPaletteForSubset(continent, avoidPastels)
    const denom = Math.max(1, names.length - 1)
    const last = palette.length - 1
    names.forEach((name, index) => {
      const paletteIndex = last <= 0 ? 0 : Math.round((index / denom) * last)
      map.set(name, palette[paletteIndex])
    })
  }

  for (const { key, canon, norm } of entries) {
    if (canon === 'Japan' || norm.toLowerCase() === 'japan') {
      map.set(key, JAPAN_RED)
      continue
    }
    if (canon && COUNTRY_COLOR_OVERRIDES[canon]) {
      map.set(key, COUNTRY_COLOR_OVERRIDES[canon])
    }
  }

  return map
}

/** Resolve color using override → Japan → subset map (same precedence as getCountryColor). */
export function getColorFromMap(map, country) {
  if (country == null || country === '') return CONTINENT_COLORS.Other[2]
  const norm = normalizeCountry(country)
  const canon = resolveCanonicalCountry(country)
  if (COUNTRY_COLOR_OVERRIDES[canon]) return COUNTRY_COLOR_OVERRIDES[canon]
  if (COUNTRY_COLOR_OVERRIDES[norm]) return COUNTRY_COLOR_OVERRIDES[norm]
  if (canon === 'Japan' || norm.toLowerCase() === 'japan') return JAPAN_RED
  if (canon && map.has(canon)) return map.get(canon)
  if (!canon && map.has(norm)) return map.get(norm)
  return CONTINENT_COLORS.Other[2]
}

function buildStableCountryColorMap() {
  const map = new Map()
  const byContinent = new Map()
  for (const [name, continent] of Object.entries(CANONICAL_COUNTRY_TO_CONTINENT)) {
    if (name === 'Japan') continue
    const list = byContinent.get(continent) || []
    list.push(name)
    byContinent.set(continent, list)
  }
  for (const [continent, names] of byContinent.entries()) {
    names.sort((a, b) => a.localeCompare(b, 'en'))
    const palette = CONTINENT_COLORS[continent] || CONTINENT_COLORS.Other
    const denom = Math.max(1, names.length - 1)
    names.forEach((name, index) => {
      const paletteIndex = Math.round((index / denom) * (palette.length - 1))
      map.set(name, palette[paletteIndex])
    })
  }
  map.set('Japan', JAPAN_RED)
  return map
}

const STABLE_COUNTRY_COLORS = buildStableCountryColorMap()

export function getCountryColor(country) {
  if (country == null || country === '') return CONTINENT_COLORS.Other[2]
  const norm = normalizeCountry(country)
  const canon = resolveCanonicalCountry(country)
  if (COUNTRY_COLOR_OVERRIDES[canon]) return COUNTRY_COLOR_OVERRIDES[canon]
  if (COUNTRY_COLOR_OVERRIDES[norm]) return COUNTRY_COLOR_OVERRIDES[norm]
  if (canon === 'Japan' || norm.toLowerCase() === 'japan') return JAPAN_RED
  if (!canon) return CONTINENT_COLORS.Other[2]
  return STABLE_COUNTRY_COLORS.get(canon) || CONTINENT_COLORS.Other[2]
}
