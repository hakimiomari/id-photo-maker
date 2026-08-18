/** "240 KB", "10 MB" — for digital-spec byte ceilings. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}
