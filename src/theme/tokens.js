export const color = {
  bg:     '#000000',
  card:   '#121214',
  card2:  '#1A1A1E',
  line:   '#26262B',
  line2:  '#2F2F35',
  txt:    '#F5F5F7',
  dim:    '#8A8A92',
  faint:  '#56565D',
  warmA:  '#FFB020',
  warmB:  '#FF6B4A',
  amber:  '#FF9030',
  copper: '#CF8020',
  cool:   '#5B8DEF',
  green:  '#30D158',
  red:    '#FF453A',
  purple: '#A855F7',
  tabBar: '#0A0A0C',
};

// Use with SVG LinearGradient or react-native-linear-gradient
export const warmGradient = ['#FFB020', '#FF6B4A'];
export const coolGradient = ['#5B8DEF', '#3B6FD4'];

// Font family strings — must match the PostScript name of installed fonts.
// Falls back to SF Pro (system) if fonts are not yet installed.
export const font = {
  display:     'BricolageGrotesque-ExtraBold',
  displaySemi: 'BricolageGrotesque-Bold',
  body:        'Inter-Regular',
  bodyMed:     'Inter-SemiBold',
  mono:        'JetBrainsMono-Regular',
  monoBold:    'JetBrainsMono-Bold',
};

export const radius = { card: 20, stat: 16, row: 14, pill: 12, full: 999 };
export const space  = { xs: 4, sm: 8, md: 11, lg: 15, xl: 18 };

export const type = {
  screenTitle: { fontFamily: font.display,     fontSize: 30, letterSpacing: -0.9, color: '#F5F5F7' },
  heroNumber:  { fontFamily: font.display,     fontSize: 68, letterSpacing: -3,   color: '#F5F5F7' },
  statValue:   { fontFamily: font.displaySemi, fontSize: 24, letterSpacing: -0.5, color: '#F5F5F7' },
  heading:     { fontFamily: font.displaySemi, fontSize: 20, letterSpacing: -0.4, color: '#F5F5F7' },
  body:        { fontFamily: font.body,        fontSize: 14,                      color: '#F5F5F7' },
  bodyStrong:  { fontFamily: font.bodyMed,     fontSize: 13.5,                    color: '#F5F5F7' },
  data:        { fontFamily: font.mono,        fontSize: 13,                      color: '#F5F5F7' },
  eyebrow:     { fontFamily: font.mono,        fontSize: 9,  letterSpacing: 1.3,  color: '#56565D', textTransform: 'uppercase' },
};

// Color rule (enforced by convention — not code):
// red    → damage ONLY (misses, cigarettes, lapse cells, out-of-range markers)
// warmA/B → growth / recovery / progress / active states
// cool   → discipline / neutral data (streaks, sleep, etc.)
// green  → logged / in-range / done
