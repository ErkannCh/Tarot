export const LS_MISERY = 'settings:misery' // legacy single toggle
export const LS_MISERY_ATOUT = 'settings:misery_atout'
export const LS_MISERY_TETE = 'settings:misery_tete'
export const LS_SCORE_CONFIG = 'settings:score_config'

export type ScoreConfig = {
  base: number
  multipliers: {
    prise: number
    garde: number
    garde_sans: number
    garde_contre: number
  }
  petit_au_bout: number
  poignee: { simple: number; double: number; triple: number }
  chelem: { non_annonce_reussi: number; annonce_reussi: number; annonce_rate: number }
}

export function defaultScoreConfig(): ScoreConfig {
  return {
    base: 25,
    multipliers: { prise: 1, garde: 2, garde_sans: 4, garde_contre: 6 },
    petit_au_bout: 10,
    poignee: { simple: 20, double: 30, triple: 40 },
    chelem: { non_annonce_reussi: 200, annonce_reussi: 400, annonce_rate: -200 },
  }
}

export function readScoreConfig(): ScoreConfig {
  try {
    const raw = localStorage.getItem(LS_SCORE_CONFIG)
    if (!raw) return defaultScoreConfig()
    const parsed = JSON.parse(raw)
    // basic shape guard with defaults
    const d = defaultScoreConfig()
    return {
      base: Number(parsed?.base ?? d.base),
      multipliers: {
        prise: Number(parsed?.multipliers?.prise ?? d.multipliers.prise),
        garde: Number(parsed?.multipliers?.garde ?? d.multipliers.garde),
        garde_sans: Number(parsed?.multipliers?.garde_sans ?? d.multipliers.garde_sans),
        garde_contre: Number(parsed?.multipliers?.garde_contre ?? d.multipliers.garde_contre),
      },
      petit_au_bout: Number(parsed?.petit_au_bout ?? d.petit_au_bout),
      poignee: {
        simple: Number(parsed?.poignee?.simple ?? d.poignee.simple),
        double: Number(parsed?.poignee?.double ?? d.poignee.double),
        triple: Number(parsed?.poignee?.triple ?? d.poignee.triple),
      },
      chelem: {
        non_annonce_reussi: Number(parsed?.chelem?.non_annonce_reussi ?? d.chelem.non_annonce_reussi),
        annonce_reussi: Number(parsed?.chelem?.annonce_reussi ?? d.chelem.annonce_reussi),
        annonce_rate: Number(parsed?.chelem?.annonce_rate ?? d.chelem.annonce_rate),
      },
    }
  } catch {
    return defaultScoreConfig()
  }
}

export function writeScoreConfig(cfg: ScoreConfig): void {
  try {
    localStorage.setItem(LS_SCORE_CONFIG, JSON.stringify(cfg))
  } catch {}
}

export function readMiserySetting(): boolean {
  // Legacy global flag (kept for backward-compat). Defaults to true.
  try {
    return localStorage.getItem(LS_MISERY) === '1'
  } catch {
    return true
  }
}

export function writeMiserySetting(enabled: boolean): void {
  // Legacy writer for global flag
  try {
    localStorage.setItem(LS_MISERY, enabled ? '1' : '0')
  } catch {}
}

export function readMiseryAtout(): boolean {
  try {
    const v = localStorage.getItem(LS_MISERY_ATOUT)
    if (v === '1') return true
    if (v === '0') return false
    // fallback to legacy if new key absent
    return readMiserySetting()
  } catch {
    return true
  }
}

export function readMiseryTete(): boolean {
  try {
    const v = localStorage.getItem(LS_MISERY_TETE)
    if (v === '1') return true
    if (v === '0') return false
    // fallback to legacy if new key absent
    return readMiserySetting()
  } catch {
    return true
  }
}

export function writeMiseryAtout(enabled: boolean): void {
  try {
    localStorage.setItem(LS_MISERY_ATOUT, enabled ? '1' : '0')
  } catch {}
}

export function writeMiseryTete(enabled: boolean): void {
  try {
    localStorage.setItem(LS_MISERY_TETE, enabled ? '1' : '0')
  } catch {}
}
