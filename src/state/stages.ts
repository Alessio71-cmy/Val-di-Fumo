/** Quale tappa è "corrente/prossima" in ciascuna fase, e per ciascun waypoint raggiunto. */
export const STAGE_FOR_PHASE: Record<string, string> = {
  prep: 's1-pergine',
  'drive-out': 's2-leno',
  leno: 's2-leno',
  'drive-dam': 's3-diga',
  'trek-prep': 's4-lago',
  'trek-out': 's4-lago',
  hut: 's8-ritorno',
  'trek-back': 's8-ritorno',
  'drive-home': 's9-rientro',
};

export const STAGE_FOR_WAYPOINT: Record<string, string> = {
  'malga-breguzzo': 's5-breguzzo',
  'fall-chiese': 's6-chiese',
  'malga-val-di-fumo': 's7-rifugio',
  'rifugio-val-di-fumo': 's7-rifugio',
};
