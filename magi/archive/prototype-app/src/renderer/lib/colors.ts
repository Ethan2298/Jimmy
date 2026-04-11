/**
 * Color Palette
 *
 * Palette 1
 *   Slate Blue     #4C6173
 *   Antique Gold   #A68C5B
 *   Warm Sand      #D9B97E
 *   Tangerine      #F27405
 *   Vermillion     #F24405
 *
 * Palette 2
 *   Midnight       #1C1D26
 *   Storm Gray     #535D73
 *   Antique Gold   #A68C5B
 *   Dark Umber     #262118
 *   Aged Bronze    #735C40
 *
 * Dark Mode
 *   Soot           #131210  — background
 *   Charcoal       #0E0D0B  — muted surfaces / sidebar
 *   Ember          #1A1916  — accent / active states
 *   Ash            #211F1B  — borders
 *   Driftwood      #8C7E6A  — muted text
 *   Cream          #F5EDDA  — foreground text
 *
 * Light Mode
 *   Cream          #F5EDDA  — background
 *   Warm Linen     #EDE4CF  — muted surfaces
 *   Parchment      #EEE5D1  — sidebar
 *   Wheat          #E3D9C2  — accent / active states
 *   Warm Border    #DDD4C0  — borders
 *   Driftwood      #8C7E6A  — muted text
 *   Espresso       #2C2416  — foreground text
 */

export const colors = {
  slateBlue: '#4C6173',
  antiqueGold: '#A68C5B',
  warmSand: '#D9B97E',
  tangerine: '#F27405',
  vermillion: '#F24405',
  midnight: '#1C1D26',
  stormGray: '#535D73',
  darkUmber: '#262118',
  agedBronze: '#735C40',

  // Dark mode
  soot: '#131210',
  charcoal: '#0E0D0B',
  ember: '#1A1916',
  ash: '#211F1B',

  // Light mode
  cream: '#F5EDDA',
  warmLinen: '#EDE4CF',
  parchment: '#EEE5D1',
  wheat: '#E3D9C2',
  warmBorder: '#DDD4C0',
  driftwood: '#8C7E6A',
  espresso: '#2C2416',
} as const
