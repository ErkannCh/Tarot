export type ThemeMode = 'dark' | 'light'

export const LS_THEME = 'settings:theme'

export function applyTheme(t: ThemeMode) {
  const root = document.documentElement
  root.dataset.theme = t
  if (t === 'light') {
    root.style.setProperty('--bg-color', '#f7f8fc')
    root.style.setProperty('--bg-elev-1', '#ffffff')
    root.style.setProperty('--bg-elev-2', '#f0f2f9')
    root.style.setProperty('--text-primary', '#171a2f')
    root.style.setProperty('--text-secondary', '#394166')
    root.style.setProperty('--muted', '#6b7399')
    root.style.setProperty('--surface-border-subtle', 'rgba(26, 49, 122, 0.08)')
    root.style.setProperty('--surface-border', 'rgba(26, 49, 122, 0.12)')
    root.style.setProperty('--surface-border-strong', 'rgba(26, 49, 122, 0.18)')
    root.style.setProperty('--surface-tint', 'rgba(15, 23, 42, 0.04)')
    root.style.setProperty('--page-gradient-1', 'rgba(91, 143, 255, 0.24)')
    root.style.setProperty('--page-gradient-2', 'rgba(91, 233, 255, 0.18)')
    root.style.setProperty('--shadow-soft', '0 18px 36px rgba(45, 70, 170, 0.16)')
    root.style.setProperty('--shadow-pop', '0 28px 52px rgba(54, 86, 185, 0.2)')
  } else {
    root.style.removeProperty('--bg-color')
    root.style.removeProperty('--bg-elev-1')
    root.style.removeProperty('--bg-elev-2')
    root.style.removeProperty('--text-primary')
    root.style.removeProperty('--text-secondary')
    root.style.removeProperty('--muted')
    root.style.removeProperty('--surface-border-subtle')
    root.style.removeProperty('--surface-border')
    root.style.removeProperty('--surface-border-strong')
    root.style.removeProperty('--surface-tint')
    root.style.removeProperty('--page-gradient-1')
    root.style.removeProperty('--page-gradient-2')
    root.style.removeProperty('--shadow-soft')
    root.style.removeProperty('--shadow-pop')
  }
}

export function initTheme(): ThemeMode {
  let t: ThemeMode = 'dark'
  try {
    const saved = localStorage.getItem(LS_THEME) as ThemeMode | null
    if (saved === 'light' || saved === 'dark') t = saved
  } catch {}
  applyTheme(t)
  return t
}
