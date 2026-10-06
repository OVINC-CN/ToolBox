export interface Region {
  code: string;
  countryCode: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
}

// Representative city centers, not the coordinates of particular cloud facilities.
export const REGIONS = [
  { code: 'SHA', countryCode: 'CN', country: '中国', city: '上海', latitude: 31.2304, longitude: 121.4737 },
  { code: 'CAN', countryCode: 'CN', country: '中国', city: '广州', latitude: 23.1291, longitude: 113.2644 },
  { code: 'HKG', countryCode: 'CN', country: '中国', city: '香港', latitude: 22.3193, longitude: 114.1694 },
  { code: 'LAX', countryCode: 'US', country: '美国', city: '洛杉矶', latitude: 34.0522, longitude: -118.2437 },
  { code: 'SJC', countryCode: 'US', country: '美国', city: '硅谷', latitude: 37.3382, longitude: -121.8863 },
  { code: 'IAD', countryCode: 'US', country: '美国', city: '弗吉尼亚', latitude: 39.0438, longitude: -77.4874 },
  { code: 'QRO', countryCode: 'MX', country: '墨西哥', city: '克雷塔罗', latitude: 20.5888, longitude: -100.3899 },
  { code: 'GRU', countryCode: 'BR', country: '巴西', city: '圣保罗', latitude: -23.5505, longitude: -46.6333 },
  { code: 'FRA', countryCode: 'DE', country: '德国', city: '法兰克福', latitude: 50.1109, longitude: 8.6821 },
  { code: 'JHB', countryCode: 'MY', country: '马来西亚', city: '新山', latitude: 1.4927, longitude: 103.7414 },
  { code: 'SIN', countryCode: 'SG', country: '新加坡', city: '新加坡', latitude: 1.3521, longitude: 103.8198 },
  { code: 'BKK', countryCode: 'TH', country: '泰国', city: '曼谷', latitude: 13.7563, longitude: 100.5018 },
  { code: 'CGK', countryCode: 'ID', country: '印度尼西亚', city: '雅加达', latitude: -6.2088, longitude: 106.8456 },
  { code: 'SEL', countryCode: 'KR', country: '韩国', city: '首尔', latitude: 37.5665, longitude: 126.978 },
  { code: 'TYO', countryCode: 'JP', country: '日本', city: '东京', latitude: 35.6762, longitude: 139.6503 },
  { code: 'OSA', countryCode: 'JP', country: '日本', city: '大阪', latitude: 34.6937, longitude: 135.5023 },
  { code: 'BOM', countryCode: 'IN', country: '印度', city: '孟买', latitude: 19.076, longitude: 72.8777 },
  { code: 'RUH', countryCode: 'SA', country: '沙特阿拉伯', city: '利雅得', latitude: 24.7136, longitude: 46.6753 },
] as const satisfies readonly Region[];

export type RegionCode = (typeof REGIONS)[number]['code'];

export function regionName(region: Region): string {
  const place = region.country === region.city ? region.country : `${region.country}${region.city}`;
  return `${region.code} ${place}`;
}

export const COUNTRIES = [...new Set(REGIONS.map(region => region.countryCode))].map(code => ({
  code,
  name: REGIONS.find(region => region.countryCode === code)?.country ?? code,
  regions: REGIONS.filter(region => region.countryCode === code),
}));

export const DEFAULT_REGIONS: readonly RegionCode[] = ['TYO', 'LAX', 'CAN'];

export function selectedRegions(codes: ReadonlySet<RegionCode>) {
  return REGIONS.filter(region => codes.has(region.code));
}
