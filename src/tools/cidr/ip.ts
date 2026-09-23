import ipaddr from 'ipaddr.js';

export type IpVersion = 4 | 6;

export interface ParsedIp {
  version: IpVersion;
  canonical: string;
  value: bigint;
  bitLength: 32 | 128;
  classification: string;
}

export interface ContainingCidr {
  prefix: number;
  cidr: string;
  first: string;
  last: string;
}

export interface ParsedCidr {
  sourceIp: ParsedIp;
  version: IpVersion;
  prefix: number;
  bitLength: 32 | 128;
  normalized: string;
  hadHostBits: boolean;
  networkValue: bigint;
  lastValue: bigint;
  total: bigint;
  first: string;
  last: string;
  netmask?: string;
  wildcard?: string;
  broadcast?: string;
  usableStart: bigint;
  usableEnd: bigint;
  usableTotal: bigint;
}

export interface AddressRow {
  value: bigint;
  address: string;
  role: string;
}

export interface AddressPage {
  rows: AddressRow[];
  page: bigint;
  pageCount: bigint;
  itemCount: bigint;
  startIndex: bigint;
  endIndex: bigint;
}

const RANGE_LABELS: Record<string, string> = {
  'unicast': '公网单播地址',
  'unspecified': '未指定地址',
  'multicast': '组播地址',
  'linkLocal': '链路本地地址',
  'loopback': '回环地址',
  'reserved': '保留地址',
  'benchmarking': '基准测试地址',
  'amt': 'AMT 中继地址',
  'broadcast': '广播地址',
  'carrierGradeNat': '运营商级 NAT 地址',
  'private': '私有地址',
  'as112': 'AS112 地址',
  'uniqueLocal': '唯一本地地址',
  'ipv4Mapped': 'IPv4 映射地址',
  'rfc6145': 'IPv4/IPv6 转换地址',
  'rfc6052': 'IPv4 嵌入地址',
  '6to4': '6to4 隧道地址',
  'teredo': 'Teredo 隧道地址',
  'as112v6': 'AS112 IPv6 地址',
  'orchid2': 'ORCHIDv2 地址',
  'droneRemoteIdProtocolEntityTags': '无人机远程标识地址',
};

function assertNoAmbiguousIpv4(input: string) {
  const dotted = /(?:^|:)(\d+\.\d+\.\d+\.\d+)$/.exec(input)?.[1];
  if (!dotted) {
    return;
  }

  const octets = dotted.split('.');
  if (octets.some(octet => octet.length > 1 && octet.startsWith('0'))) {
    throw new Error('IPv4 地址不能包含有歧义的前导零');
  }
}

function bytesToBigInt(bytes: number[]) {
  return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
}

function allBits(bitLength: 32 | 128) {
  return (1n << BigInt(bitLength)) - 1n;
}

function networkMask(bitLength: 32 | 128, prefix: number) {
  if (prefix === 0) {
    return 0n;
  }
  const hostBits = BigInt(bitLength - prefix);
  return allBits(bitLength) ^ ((1n << hostBits) - 1n);
}

export function formatIpv4(value: bigint) {
  return [24n, 16n, 8n, 0n]
    .map(shift => Number((value >> shift) & 255n))
    .join('.');
}

export function formatIpv6(value: bigint) {
  const parts = Array.from({ length: 8 }, (_, index) =>
    Number((value >> BigInt((7 - index) * 16)) & 0xffffn),
  );

  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;

  for (let index = 0; index <= parts.length; index += 1) {
    if (index < parts.length && parts[index] === 0) {
      if (currentStart === -1) {
        currentStart = index;
      }
      continue;
    }

    if (currentStart !== -1) {
      const length = index - currentStart;
      if (length > bestLength) {
        bestStart = currentStart;
        bestLength = length;
      }
      currentStart = -1;
    }
  }

  const hex = parts.map(part => part.toString(16));
  if (bestLength < 2) {
    return hex.join(':');
  }

  const left = hex.slice(0, bestStart).join(':');
  const right = hex.slice(bestStart + bestLength).join(':');
  if (!left && !right) {
    return '::';
  }
  if (!left) {
    return `::${right}`;
  }
  if (!right) {
    return `${left}::`;
  }
  return `${left}::${right}`;
}

export function formatIp(value: bigint, version: IpVersion) {
  return version === 4 ? formatIpv4(value) : formatIpv6(value);
}

export function parseIp(input: string): ParsedIp {
  const text = input.trim();
  if (!text) {
    throw new Error('请输入一个 IPv4 或 IPv6 地址');
  }
  if (text.includes('%')) {
    throw new Error('暂不支持带区域标识的 IPv6 地址');
  }
  if (text.includes('/')) {
    throw new Error('这里请输入单个 IP；网段请切换到“网段查 IP”');
  }

  assertNoAmbiguousIpv4(text);
  if (!ipaddr.isValid(text)) {
    throw new Error('IP 地址格式不正确');
  }

  const address = ipaddr.parse(text);
  const version: IpVersion = address.kind() === 'ipv4' ? 4 : 6;
  const bitLength = version === 4 ? 32 : 128;

  return {
    version,
    canonical: address.toString(),
    value: bytesToBigInt(address.toByteArray()),
    bitLength,
    classification: RANGE_LABELS[address.range()] ?? '有效地址',
  };
}

export function getContainingCidrs(ip: ParsedIp): ContainingCidr[] {
  const rows: ContainingCidr[] = [];

  for (let prefix = ip.bitLength; prefix >= 0; prefix -= 1) {
    const mask = networkMask(ip.bitLength, prefix);
    const network = ip.value & mask;
    const last = network | (allBits(ip.bitLength) ^ mask);
    rows.push({
      prefix,
      cidr: `${formatIp(network, ip.version)}/${prefix}`,
      first: formatIp(network, ip.version),
      last: formatIp(last, ip.version),
    });
  }

  return rows;
}

export function parseCidr(input: string): ParsedCidr {
  const text = input.trim();
  if (!text) {
    throw new Error('请输入 CIDR 网段，例如 192.168.1.0/24');
  }

  const pieces = text.split('/');
  if (pieces.length !== 2 || !pieces[0] || !pieces[1]) {
    throw new Error('网段必须包含前缀长度，例如 /24 或 /64');
  }

  const prefixText = pieces[1];
  if (!/^(0|[1-9]\d*)$/.test(prefixText)) {
    throw new Error('前缀长度必须是非负整数，且不能包含前导零');
  }

  const sourceIp = parseIp(pieces[0]);
  const prefix = Number(prefixText);
  if (prefix > sourceIp.bitLength) {
    throw new Error(
      sourceIp.version === 4
        ? 'IPv4 前缀长度必须在 0 到 32 之间'
        : 'IPv6 前缀长度必须在 0 到 128 之间',
    );
  }

  const mask = networkMask(sourceIp.bitLength, prefix);
  const networkValue = sourceIp.value & mask;
  const lastValue = networkValue | (allBits(sourceIp.bitLength) ^ mask);
  const total = 1n << BigInt(sourceIp.bitLength - prefix);
  const isConventionalIpv4Subnet = sourceIp.version === 4 && prefix <= 30;
  const usableStart = isConventionalIpv4Subnet
    ? networkValue + 1n
    : networkValue;
  const usableEnd = isConventionalIpv4Subnet ? lastValue - 1n : lastValue;
  const usableTotal = isConventionalIpv4Subnet ? total - 2n : total;

  const result: ParsedCidr = {
    sourceIp,
    version: sourceIp.version,
    prefix,
    bitLength: sourceIp.bitLength,
    normalized: `${formatIp(networkValue, sourceIp.version)}/${prefix}`,
    hadHostBits: sourceIp.value !== networkValue,
    networkValue,
    lastValue,
    total,
    first: formatIp(networkValue, sourceIp.version),
    last: formatIp(lastValue, sourceIp.version),
    usableStart,
    usableEnd,
    usableTotal,
  };

  if (sourceIp.version === 4) {
    result.netmask = formatIpv4(mask);
    result.wildcard = formatIpv4(allBits(32) ^ mask);
    result.broadcast = formatIpv4(lastValue);
  }

  return result;
}

function roleForAddress(subnet: ParsedCidr, value: bigint) {
  if (subnet.version === 6) {
    if (value === subnet.networkValue) {
      return '网段首址';
    }
    if (value === subnet.lastValue) {
      return '网段末址';
    }
    return '地址';
  }

  if (subnet.prefix <= 30) {
    if (value === subnet.networkValue) {
      return '网络地址';
    }
    if (value === subnet.lastValue) {
      return '广播地址';
    }
    return '可用主机';
  }

  if (subnet.prefix === 31) {
    return '点对点端点';
  }
  return '单主机';
}

export function getAddressPage(
  subnet: ParsedCidr,
  requestedPage: bigint,
  pageSize: number,
  usableOnly: boolean,
): AddressPage {
  const useUsableRange = usableOnly && subnet.version === 4;
  const firstValue = useUsableRange ? subnet.usableStart : subnet.networkValue;
  const lastValue = useUsableRange ? subnet.usableEnd : subnet.lastValue;
  const itemCount = useUsableRange ? subnet.usableTotal : subnet.total;
  const size = BigInt(pageSize);
  const pageCount = (itemCount + size - 1n) / size;
  const page
    = requestedPage < 1n
      ? 1n
      : requestedPage > pageCount
        ? pageCount
        : requestedPage;
  const offset = (page - 1n) * size;
  const pageStart = firstValue + offset;
  const pageEnd
    = pageStart + size - 1n > lastValue ? lastValue : pageStart + size - 1n;
  const rows: AddressRow[] = [];

  for (let value = pageStart; value <= pageEnd; value += 1n) {
    rows.push({
      value,
      address: formatIp(value, subnet.version),
      role: roleForAddress(subnet, value),
    });
  }

  return {
    rows,
    page,
    pageCount,
    itemCount,
    startIndex: offset + 1n,
    endIndex: offset + BigInt(rows.length),
  };
}

export function formatBigInt(value: bigint) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
