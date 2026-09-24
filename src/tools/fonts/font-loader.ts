import type { SampleKind, SpecimenFont } from './fonts';

export type FontOrigin = 'local' | 'remote' | 'failed';

const loads = new Map<string, Promise<FontOrigin>>();

function familyName(font: SpecimenFont) {
  return `ToolBoxSpecimen_${font.id.replaceAll('-', '_')}`;
}

export function specimenFamily(font: SpecimenFont, kind: SampleKind, origin: 'local' | 'remote') {
  const family = familyName(font);
  if (origin === 'remote' && font.latinRemoteUrl) {
    return kind === 'zh'
      ? `${family}_zh, ${family}_latin`
      : `${family}_latin, ${family}_zh`;
  }
  return family;
}

async function tryFontFace(family: string, source: string): Promise<FontFace | null> {
  try {
    const face = new FontFace(family, source, { style: 'normal', weight: '400' });
    await face.load();
    return face;
  }
  catch {
    return null;
  }
}

async function loadFont(font: SpecimenFont): Promise<FontOrigin> {
  if (typeof FontFace === 'undefined') {
    return 'failed';
  }

  const family = familyName(font);
  const localSources = font.localNames
    .map(name => `local("${name}")`)
    .join(', ');
  const localFace = await tryFontFace(family, localSources);
  if (localFace) {
    document.fonts.add(localFace);
    return 'local';
  }

  const remoteUrls = font.latinRemoteUrl
    ? [font.remoteUrl, font.latinRemoteUrl]
    : [font.remoteUrl];
  const remoteFaces = await Promise.all(remoteUrls.map((url, index) => {
    const format = url.endsWith('.otf') ? 'opentype' : 'woff2';
    const subsetFamily = font.latinRemoteUrl
      ? `${family}_${index === 0 ? 'zh' : 'latin'}`
      : family;
    return tryFontFace(subsetFamily, `url("${url}") format("${format}")`);
  }));
  if (remoteFaces.every((face): face is FontFace => face !== null)) {
    remoteFaces.forEach((face) => {
      document.fonts.add(face);
    });
    return 'remote';
  }

  return 'failed';
}

export function ensureSpecimenFont(font: SpecimenFont): Promise<FontOrigin> {
  const pending = loads.get(font.id);
  if (pending) {
    return pending;
  }

  // A failure is retriable; successful loads stay shared across filters and mounts.
  const next = loadFont(font).then((result) => {
    if (result === 'failed') {
      loads.delete(font.id);
    }
    return result;
  });
  loads.set(font.id, next);
  return next;
}
