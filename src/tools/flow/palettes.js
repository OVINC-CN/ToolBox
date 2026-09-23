// 依次映射参考图中的粉、珊瑚、金黄、浅蓝、淡紫。
export const PALETTES = [
  {
    id: 'daydream',
    name: '柔光彩霞',
    colors: ['#ff6fac', '#ff916f', '#ffe970', '#9dcdff', '#c49ff7'],
  },
  {
    id: 'peach',
    name: '蜜桃日落',
    colors: ['#ff8ba7', '#ff9973', '#ffd89f', '#ffe6bf', '#f6aac3'],
  },
  {
    id: 'mint',
    name: '薄荷海盐',
    colors: ['#8fe6cf', '#afedce', '#e5f4bb', '#91d8ed', '#b1caec'],
  },
  {
    id: 'lavender',
    name: '薰衣草雾',
    colors: ['#dba9e4', '#e5bedc', '#f4ddec', '#b9c2f1', '#9b8bdd'],
  },
  {
    id: 'ocean',
    name: '蔚蓝潮汐',
    colors: ['#528eeb', '#56bdd7', '#b7ebed', '#88c7f4', '#4056c0'],
  },
  {
    id: 'rose',
    name: '玫瑰气泡',
    colors: ['#f36fb4', '#f895ad', '#ffd0c2', '#ecc2f5', '#c087e2'],
  },
  {
    id: 'lime',
    name: '青柠苏打',
    colors: ['#99dca6', '#cce79b', '#eef0a0', '#97e0d9', '#63bfb5'],
  },
  {
    id: 'amber',
    name: '琥珀流金',
    colors: ['#d89162', '#eda45f', '#f8d875', '#ecdab0', '#c8ad8f'],
  },
  {
    id: 'aurora',
    name: '极光幻境',
    colors: ['#8d70e8', '#559dd3', '#93e2ce', '#56cdd4', '#a184f0'],
  },
  {
    id: 'midnight',
    name: '午夜星云',
    colors: ['#663774', '#7e4d83', '#b67c96', '#34476f', '#2b2853'],
  },
];
export function palettePreview(c) {
  return `linear-gradient(125deg, ${c[3]}, ${c[4]} 25%, ${c[0]} 48%, ${c[1]} 72%, ${c[2]})`;
}
