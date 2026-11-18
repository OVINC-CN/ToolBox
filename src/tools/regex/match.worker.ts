export interface MatchRequest {
  pattern: string;
  flags: string;
  text: string;
}

export interface Hit {
  start: number;
  end: number;
  groups: (string | undefined)[];
}

export type MatchResult = { hits: Hit[]; limited: boolean } | { error: string };

function match({ pattern, flags, text }: MatchRequest): MatchResult {
  const regex = new RegExp(pattern, flags);
  const hits: Hit[] = [];
  const first = regex.global ? null : regex.exec(text);
  const matches = regex.global ? text.matchAll(regex) : first ? [first] : [];
  for (const item of matches) {
    if (hits.length === 100) {
      return { hits, limited: true };
    }
    hits.push({
      start: item.index,
      end: item.index + item[0].length,
      groups: item.slice(1).map((value: string | undefined) =>
        value && value.length > 120 ? `${value.slice(0, 120)}…` : value),
    });
  }
  return { hits, limited: false };
}

self.onmessage = ({ data }: MessageEvent<MatchRequest>) => {
  try {
    self.postMessage(match(data));
  }
  catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '匹配失败' });
  }
};
