import {
  v1,
  v4,
  v6,
  v7,
  validate,
  version as uuidVersion,
} from './vendor/uuid/index.js';

export const VERSIONS = {
  1: {
    title: '时间与节点',
    brief:
      '时间戳 + 时钟序列 + 节点标识。本站使用随机节点，不读取设备的 MAC 地址。',
    kind: '时间型',
    hint: '时间散布在前三段；时钟序列用来降低时钟回拨时的重复风险。',
  },
  4: {
    title: '随机生成',
    brief: '122 位安全随机数据，加上版本和变体标记。不包含时间戳或机器标识。',
    kind: '随机型',
    hint: '每次都生成新的随机数据；相同的版本标记，不代表相同的 UUID。',
  },
  6: {
    title: '有序时间',
    brief:
      '把 v1 的时间字段按高位到低位排列，便于按时间排序。本站使用随机节点。',
    kind: '时间型',
    hint: '与 v1 包含相同种类的字段，区别在于时间的排列方式。',
  },
  7: {
    title: '时间与随机',
    brief: '毫秒时间戳在前，序列与随机数据在后。不包含机器标识。',
    kind: '时间型',
    hint: '本站使用随机起点的 32 位序列，在同一毫秒内递增；另有 42 位随机数据。',
  },
};

const functions = { 1: v1, 4: v4, 6: v6, 7: v7 };
export function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('请提供版本和生成数量。');
  }
  if (Object.keys(input).some(key => !['version', 'count'].includes(key))) {
    throw new Error('仅支持 version 和 count 参数。');
  }
  if (![1, 4, 6, 7].includes(input.version)) {
    throw new Error('请选择 v1、v4、v6 或 v7。');
  }
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 1000) {
    throw new Error('生成数量需为 1–1000 的整数。');
  }
  return { version: input.version, count: input.count };
}

export function generateUuids(input) {
  const { version, count } = validateRequest(input);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('当前浏览器不支持安全随机数，请使用新版浏览器。');
  }
  return Array.from({ length: count }, () => functions[version]());
}

const field = (id, name, start, width, tone, description) => ({
  id,
  name,
  start,
  width,
  tone,
  description,
});
const ver = v =>
  field('version', '版本', 48, 4, 'version', `固定为 ${v}，表示 UUID v${v}。`);
const variant = field(
  'variant',
  '变体',
  64,
  2,
  'variant',
  '固定为二进制 10，表示标准 UUID 布局；同一字符的低 2 位仍是数据。',
);
const node = field(
  'node',
  '节点标识',
  80,
  48,
  'node',
  '本站随机生成，不是本机 MAC 地址。',
);
const clock = field(
  'clock',
  '时钟序列',
  66,
  14,
  'sequence',
  '辅助避免时钟回拨等情况导致重复；本站使用库生成的序列值。',
);
const rand = (start, width, id) =>
  field(
    id,
    '随机数',
    start,
    width,
    'random',
    '由浏览器的密码学安全随机源提供。',
  );

export function fieldLayout(version) {
  switch (version) {
    case 1:
      return [
        field(
          'time-low',
          '时间低位',
          0,
          32,
          'time',
          '100 纳秒计数的低 32 位。',
        ),
        field(
          'time-mid',
          '时间中位',
          32,
          16,
          'time',
          '同一个时间戳的中间 16 位。',
        ),
        ver(1),
        field(
          'time-high',
          '时间高位',
          52,
          12,
          'time',
          '同一个时间戳的高 12 位。',
        ),
        variant,
        clock,
        node,
      ];
    case 4:
      return [
        rand(0, 48, 'random-a'),
        ver(4),
        rand(52, 12, 'random-b'),
        variant,
        rand(66, 62, 'random-c'),
      ];
    case 6:
      return [
        field(
          'time-high',
          '时间高位',
          0,
          32,
          'time',
          '时间戳的高 32 位，排在最前。',
        ),
        field('time-mid', '时间中位', 32, 16, 'time', '时间戳的中间 16 位。'),
        ver(6),
        field('time-low', '时间低位', 52, 12, 'time', '时间戳的低 12 位。'),
        variant,
        clock,
        node,
      ];
    case 7:
      return [
        field(
          'timestamp',
          '时间戳',
          0,
          48,
          'time',
          '自 1970 年起的毫秒数，分布在前两段。',
        ),
        ver(7),
        field(
          'seq-high',
          '序列',
          52,
          12,
          'sequence',
          '32 位序列的高 12 位；随机初始化，同毫秒内递增。',
        ),
        variant,
        field(
          'seq-low',
          '序列',
          66,
          20,
          'sequence',
          '32 位序列的低 20 位，跨越第四和第五段。',
        ),
        rand(86, 42, 'random'),
      ];
    default:
      throw new Error('不支持的 UUID 版本。');
  }
}

function readBits(value, start, width) {
  return (value >> BigInt(128 - start - width)) & ((1n << BigInt(width)) - 1n);
}

export function inspectUuid(uuid) {
  if (!validate(uuid)) {
    throw new Error('无效的 UUID。');
  }
  const version = uuidVersion(uuid);
  if (![1, 4, 6, 7].includes(version)) {
    throw new Error('不支持的 UUID 版本。');
  }
  const normalized = uuid.toLowerCase();
  const value = BigInt('0x' + normalized.replaceAll('-', ''));
  const fields = fieldLayout(version).map(f => ({
    ...f,
    value: readBits(value, f.start, f.width).toString(),
    hex: readBits(value, f.start, f.width)
      .toString(16)
      .padStart(Math.ceil(f.width / 4), '0'),
  }));
  const boundaries = [
    [0, 32],
    [32, 48],
    [48, 64],
    [64, 80],
    [80, 128],
  ];
  const groups = normalized.split('-').map((text, index) => {
    const [start, end] = boundaries[index];
    const parts = fields.flatMap((f) => {
      const left = Math.max(start, f.start),
        right = Math.min(end, f.start + f.width);
      return left < right
        ? [
          {
            ...f,
            start: left,
            width: right - left,
            value: readBits(value, left, right - left).toString(),
            hex: readBits(value, left, right - left)
              .toString(16)
              .padStart(Math.ceil((right - left) / 4), '0'),
          },
        ]
        : [];
    });
    return { text, start, width: end - start, parts };
  });
  const result = {
    uuid: normalized,
    version,
    fields,
    groups,
    variant: readBits(value, 64, 2).toString(2),
    timestamp: null,
    clockSequence: null,
    sequence: null,
    node: null,
  };
  if (version === 1 || version === 6) {
    const ticks
      = version === 1
        ? (readBits(value, 52, 12) << 48n)
        | (readBits(value, 32, 16) << 32n)
        | readBits(value, 0, 32)
        : (readBits(value, 0, 48) << 12n) | readBits(value, 52, 12);
    const unixTicks = ticks - 122192928000000000n;
    const millis
      = unixTicks / 10000n
        - (unixTicks < 0n && unixTicks % 10000n !== 0n ? 1n : 0n);
    result.timestamp = {
      milliseconds: Number(millis),
      iso: new Date(Number(millis)).toISOString(),
      ticks: ticks.toString(),
    };
    result.clockSequence = Number(readBits(value, 66, 14));
    result.node = readBits(value, 80, 48).toString(16).padStart(12, '0');
  }
  else if (version === 7) {
    const millis = Number(readBits(value, 0, 48));
    result.timestamp = {
      milliseconds: millis,
      iso: new Date(millis).toISOString(),
    };
    result.sequence = Number(
      (readBits(value, 52, 12) << 20n) | readBits(value, 66, 20),
    );
  }
  return result;
}
