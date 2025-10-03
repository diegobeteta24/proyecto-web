// Simple mojibake fixer for common UTF-8 sequences mis-decoded as ISO-8859-1/Windows-1252.
// This does not mutate original data; it's only for display.
export function fixMojibake(input: any): string {
  if (typeof input !== 'string' || !input) return String(input ?? '')
  let s = input
  // Map common sequences
  const map: Record<string, string> = {
    'Ã¡': 'á', 'ÃÁ': 'Á', 'Ã©': 'é', 'Ã‰': 'É', 'Ãí': 'í', 'ÃÍ': 'Í',
    'Ã³': 'ó', 'Ã“': 'Ó', 'Ãú': 'ú', 'ÃÚ': 'Ú', 'Ã±': 'ñ', 'Ã‘': 'Ñ',
    'Ã¼': 'ü', 'Ãœ': 'Ü'
  }
  for (const k in map) {
    s = s.split(k).join(map[k])
  }
  return s
}

export function safeDisplayName(name: any): string {
  return fixMojibake(name)
}