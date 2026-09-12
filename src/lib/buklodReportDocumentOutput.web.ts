export async function outputReportDocument(html: string, fileName: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Document export is available only in a browser session.');
  }
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  return fileName;
}
