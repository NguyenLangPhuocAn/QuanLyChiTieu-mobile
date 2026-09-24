import { normalizeTagName, parseTagsInput } from '../src/utils/hashtags';

describe('hashtag input parsing', () => {
  it('keeps transport tags with mixed comma and hashtag separators', () => {
    expect(parseTagsInput('di chuyển, #ăn uống, học tập')).toEqual([
      'di chuyển',
      'ăn uống',
      'học tập',
    ]);
  });
  it('normalizes spaces after the hash and decomposed Vietnamese accents', () => {
    expect(parseTagsInput('#  DI   CHUYỂN #di chuyển')).toEqual(['di chuyển']);
    expect(normalizeTagName(' #   ')).toBe('');
  });
  it('keeps multi-word Vietnamese hashtags together when followed by another hashtag', () => {
    expect(parseTagsInput('#báo cáo #anuong')).toEqual(['báo cáo', 'anuong']);
  });

  it('matches a plain multi-word tag with the same suggested hashtag name', () => {
    expect(parseTagsInput('báo cáo')).toContain(normalizeTagName('báo cáo'));
  });

  it('normalizes visually identical Vietnamese accents to the same value', () => {
    expect(normalizeTagName('ba\u0301o ca\u0301o')).toBe('báo cáo');
  });

  it('still parses compact hashtag lists separated by # markers', () => {
    expect(parseTagsInput('#antrua #congviec')).toEqual(['antrua', 'congviec']);
  });
});
