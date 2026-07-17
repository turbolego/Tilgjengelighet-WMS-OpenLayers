/**
 * Dark-themed palette matching the web app's ink/amber/steel aesthetic.
 */
export const MapTheme = {
  ink: '#0d1117',
  inkMid: '#1c2533',
  inkLight: '#2d3f55',
  steel: '#3a5068',
  mist: '#b0c6d4',
  fog: '#c8d8e4',
  paper: '#f0f4f7',
  white: '#ffffff',
  amber: '#ecaa30',
  amberDeep: '#c07010',
  redWarn: '#c0392b',
} as const;

export const MapColors = {
  /** Panel/modal background */
  surface: MapTheme.inkMid,
  /** Button background */
  buttonBg: 'rgba(13, 17, 23, 0.88)',
  /** Button text */
  buttonText: MapTheme.fog,
  /** Settings cog accent */
  accent: MapTheme.amber,
  accentHover: MapTheme.amberDeep,
  /** Status bar */
  statusBg: 'rgba(13, 17, 23, 0.82)',
  statusText: MapTheme.mist,
  /** Modal backdrop */
  backdrop: 'rgba(0, 0, 0, 0.55)',
  /** Divider */
  divider: MapTheme.steel,
  /** Text */
  headingText: MapTheme.amber,
  bodyText: MapTheme.fog,
  mutedText: MapTheme.mist,
  whiteText: MapTheme.white,
  /** Borders */
  border: MapTheme.steel,
};