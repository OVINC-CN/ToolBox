import { lazy } from 'react';
import type { ComponentType } from 'react';

export function lazyPage(load: () => Promise<{ default: ComponentType; styles: string }>) {
  return lazy(async () => {
    const { default: Component, styles } = await load();
    function Page() {
      return (
        <>
          <style>{styles}</style>
          <Component />
        </>
      );
    }
    return { default: Page };
  });
}

const entries = [
  {
    id: 'unix',
    pageTitle: 'TIME · Unix 时间戳转换',
    pageDescription: '在 Unix 时间戳、日期时间字符串与全球时区之间快速双向转换。',
    Page: lazyPage(() => import('../tools/unix/App')),
    title: 'Unix 时间戳',
    description: '在日期时间与 Unix 时间戳之间转换。',
    kind: 'clock',
    tone: 'dark',
  },
  {
    id: 'uuid',
    pageTitle: 'UUID Lab · UUID 生成与字段解读',
    pageDescription: '生成 UUID v1、v4、v6、v7，在真实 UUID 下方直接看懂时间戳、随机数、版本、变体和节点标识。支持批量生成与复制，全部在浏览器本地完成。',
    Page: lazyPage(() => import('../tools/uuid/App')),
    title: 'UUID 生成',
    description: '生成 UUID v1、v4、v6、v7 并查看字段。',
    kind: 'uuid',
    tone: 'orange',
  },
  {
    id: 'json',
    pageTitle: 'JSON Studio · JSON 格式化',
    pageDescription: '在浏览器中格式化、编辑、折叠和压缩 JSON，实时定位语法错误。',
    Page: lazyPage(() => import('../tools/json/App')),
    title: 'JSON 格式化',
    description: '格式化、编辑、折叠 JSON，定位语法错误。',
    kind: 'json',
    tone: 'light',
  },
  {
    id: 'cidr',
    pageTitle: 'IP CIDR · IP 网段转换',
    pageDescription: '在浏览器本地完成 IPv4、IPv6 与 CIDR 网段的双向换算。',
    Page: lazyPage(() => import('../tools/cidr/App')),
    title: 'IP 网段转换',
    description: '查询 IP 所属网段，按 CIDR 列出地址。',
    kind: 'cidr',
    tone: 'orange',
  },
  {
    id: 'urlencode',
    pageTitle: 'URL 编解码 · Tool Box',
    pageDescription: '在浏览器本地使用 URI 组件规则即时进行 URL 编码与解码。',
    Page: lazyPage(() => import('../tools/urlencode/App')),
    title: 'URL 编解码',
    description: '在文本与 URL 编码之间即时转换。',
    kind: 'url',
    tone: 'dark',
  },
  {
    id: 'box',
    pageTitle: 'CloudBin Lab · VM 装箱模拟',
    pageDescription: '可回放、可解释的云厂商 VM 多维资源装箱教学模拟器。',
    Page: lazyPage(() => import('../tools/box/App')),
    title: 'VM 装箱模拟',
    description: '模拟 VM 分配，比较主机资源利用率。',
    kind: 'box',
    tone: 'light',
  },
  {
    id: 'regex',
    pageTitle: '正则可视化 · Tool Box',
    pageDescription: '在浏览器中查看正则表达式结构、匹配范围与捕获组。',
    Page: lazyPage(() => import('../tools/regex/App')),
    title: '正则可视化',
    description: '查看正则表达式的结构、匹配结果与捕获组。',
    kind: 'regex',
    tone: 'light',
  },
] as const;

export const tools = entries.map(entry => ({
  ...entry,
  url: `/${entry.id}/`,
}));
