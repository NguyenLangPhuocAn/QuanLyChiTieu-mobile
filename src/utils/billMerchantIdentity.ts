// Deliberately conservative equivalence, not fuzzy vendor matching. Keep package
// names and numbers; unrelated brand/name changes still need manual review.
export function billMerchantIdentity(normalized: string) {
  let name = normalized.replace(
    /^(?:(?:thanh toan|payment for|hoa don|cuoc)\s+)+/,
    '',
  );
  if (
    /^(chuyen khoan|chuyen vi|wallet transfer|hoan tien|refund)(?: |$)/.test(
      name,
    )
  )
    return name;
  if (/\binternet\b/.test(name))
    name = name.replace(/\b(fpt|viettel) telecom\b/g, '$1');
  if (/\b(internet|wifi|dien|nuoc|netflix|spotify|icloud|youtube)\b/.test(name))
    return name.split(' ').filter(Boolean).sort().join(' ');
  return name;
}
