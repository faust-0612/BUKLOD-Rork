/** Error presentation only. Never work around untrusted SSL certificates. */
export function bibleReportErrorMessage(error: unknown): string {
  const message = String((error as { message?: string } | null)?.message ?? error ?? '');
  if (/SSLHandshakeException|CertPathValidatorException|Trust anchor|certificate (path|chain|verify)/i.test(message)) {
    return 'May SSL/certificate verification error sa koneksiyon. Hindi ligtas na i-disable ang certificate checking. Suriin ang internet, tamang oras sa device, at server certificate.';
  }
  if (/fetch failed|network request failed|timeout|connection|offline/i.test(message)) {
    return 'Hindi makontak ang Bible Report server. Suriin ang koneksiyon at subukan muli.';
  }
  return message && message.length < 180 ? message : 'Pansamantalang hindi available ang Bible Report. Subukan muli.';
}
