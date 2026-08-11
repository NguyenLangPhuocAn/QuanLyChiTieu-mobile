export const normalizeTagName = (tag: string) =>
  tag
    .normalize('NFC')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 50);

export const parseTagsInput = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  const rawTags = trimmed.includes('#')
    ? [...trimmed.matchAll(/#([^#,\n\r]+)/g)].map(match => match[1])
    : trimmed.split(/[,\n\r]+/);

  return [...new Set(rawTags.map(normalizeTagName).filter(Boolean))].slice(0, 8);
};
