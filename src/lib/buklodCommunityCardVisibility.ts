export function isHiddenCommunityCardCopy(
  ...values: Array<string | null | undefined>
) {
  const copy = values
    .map(value => String(value ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');

  if (!copy) {
    return false;
  }

  return (
    copy.includes('community board') ||
    copy.includes('samahang binuklod')
  );
}
