// Pure AdMob Network report parser; excludes mediation and user ad events.
export function summarizeDatedAdmobReport(report, appId, reportDay) {
  if (!Array.isArray(report)) throw new Error('Unexpected AdMob report response');
  const header = report.find(item => item?.header)?.header;
  if (header?.localizationSettings?.currencyCode !== 'PHP')
    throw new Error('AdMob did not confirm PHP report currency');
  if (!report.some((item) => item?.footer))
    throw new Error('AdMob network report footer missing');
  if (!/^\d{8}$/.test(reportDay)) throw new Error('Invalid AdMob reporting date');
  let totalMicros = 0n;
  let dayMicros = 0n;
  for (const entry of report) {
    if (!entry?.row) continue;
    if (entry.row.dimensionValues?.APP?.value !== appId)
      throw new Error('AdMob report included an unexpected app');
    const day = entry.row.dimensionValues?.DATE?.value;
    if (!/^\d{8}$/.test(String(day)) || day.slice(0, 6) !== reportDay.slice(0, 6) || day > reportDay)
      throw new Error('AdMob report date outside requested period');
    const micros = String(entry.row.metricValues?.ESTIMATED_EARNINGS?.microsValue ?? '');
    if (!/^\d+$/.test(micros)) throw new Error('AdMob report earnings format invalid');
    totalMicros += BigInt(micros);
    if (day === reportDay) dayMicros += BigInt(micros);
  }
  if (totalMicros < 0n || totalMicros > 1_000_000_000_000_000n)
    throw new Error('AdMob report amount outside configured preliminary bound');
  return { totalMicros, dayMicros };
}
