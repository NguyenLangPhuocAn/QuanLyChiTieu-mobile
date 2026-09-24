export const normalizeTagName = (tag: string) =>
  tag
    .normalize('NFC')
    .trim()
    .replace(/^#+/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 50);

export const parseTagsInput = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  const rawTags = trimmed.split(/[#,\n\r]+/);

  return [...new Set(rawTags.map(normalizeTagName).filter(Boolean))].slice(
    0,
    8,
  );
};
