/**
 * Website colour themes.
 *
 * Every colour on the site (customer pages and admin panel) comes from CSS
 * variables such as --color-brand-500 (see index.css). Applying a theme just
 * rewrites those variables on <html>, so the whole website changes at once.
 *
 * The admin picks one of the presets and can fine-tune three colours:
 *   primary - buttons, links, highlights  -> --color-brand-50 ... 700
 *   heading - titles and dark accents     -> --color-brand-800 / 900
 *   text    - paragraphs and labels       -> --color-slate-400 ... 950
 */

export const DEFAULT_PRESET = 'green';

export const THEME_PRESETS = [
  {
    id: 'green',
    name: 'Fresh Green',
    description: 'Leafy green - the original look',
    primary: '#4caf50',
    // The original hand-tuned greens
    palette: {
      50: '#f1f8f2',
      100: '#e3f2e5',
      200: '#c8e6c9',
      300: '#a5d6a7',
      400: '#81c784',
      500: '#4caf50',
      600: '#43a047',
      700: '#388e3c',
      800: '#2e7d32',
      900: '#1b5e20',
    },
    beige: '#faf7f0',
  },
  {
    id: 'gold',
    name: 'Sri Krishna Gold',
    description: 'Gold and navy from the store logo card',
    primary: '#c8a351',
    heading: '#1c2333',
    text: '#262d3b',
    beige: '#fbf8f1',
  },
  {
    id: 'red',
    name: 'Kumkum Red',
    description: 'Bold supermarket red, like the logo name',
    primary: '#d93025',
    beige: '#fdf7f4',
  },
  {
    id: 'orange',
    name: 'Saffron Orange',
    description: 'Warm, festive and friendly',
    primary: '#ef7d0b',
    beige: '#fdf8f1',
  },
  {
    id: 'blue',
    name: 'Peacock Blue',
    description: 'Calm and trusted, from the logo peacock',
    primary: '#1d6fb8',
    beige: '#f6f8fb',
  },
];

export const findPreset = (id) => THEME_PRESETS.find((p) => p.id === id) || THEME_PRESETS[0];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (value) => typeof value === 'string' && HEX.test(value);

/* ------------------------------------------------------------------
   Colour maths in OKLCH, so generated shades look evenly spaced
   ------------------------------------------------------------------ */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const rgbToHex = (rgb) =>
  `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;

const hexToOklch = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
};

const oklchToLinear = ([L, C, H]) => {
  const A = C * Math.cos((H * Math.PI) / 180);
  const B = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

/** OKLCH -> hex, lowering the chroma until the colour fits on screens (sRGB) */
const oklchToHex = ([L, C, H]) => {
  let chroma = C;
  for (let i = 0; i < 40; i += 1) {
    const linear = oklchToLinear([L, chroma, H]);
    if (linear.every((v) => v >= -0.0001 && v <= 1.0001)) return rgbToHex(linear.map((v) => toGamma(Math.min(1, Math.max(0, v)))));
    chroma *= 0.9;
  }
  return rgbToHex(oklchToLinear([L, 0, H]).map((v) => toGamma(Math.min(1, Math.max(0, v)))));
};

/** Mix two colours in OKLab-ish space: amount 0 = a, 1 = b */
const mix = (a, b, amount) => {
  const [L1, C1, H1] = hexToOklch(a);
  const [L2, C2] = hexToOklch(b);
  return oklchToHex([L1 + (L2 - L1) * amount, C1 + (C2 - C1) * amount, H1]);
};

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** 50 ... 700 shades around a main colour, which stays exactly at 500 */
const paletteFrom = (primary) => {
  const [L, C, H] = hexToOklch(primary);
  const light = {};
  light[300] = Math.max(0.83, L + 0.05);
  light[200] = Math.min(0.97, Math.max(0.9, light[300] + 0.04));
  light[100] = Math.min(0.98, Math.max(0.95, light[200] + 0.025));
  light[50] = Math.min(0.99, Math.max(0.975, light[100] + 0.015));
  light[400] = (L + light[300]) / 2;
  const dark = {
    600: Math.min(L - 0.05, 0.62),
    700: Math.min(L - 0.11, 0.54),
    800: Math.min(L - 0.18, 0.45),
    900: Math.min(L - 0.25, 0.37),
  };
  const chroma = { 50: 0.12, 100: 0.25, 200: 0.5, 300: 0.75, 400: 0.92, 600: 0.97, 700: 0.92, 800: 0.82, 900: 0.72 };
  const palette = { 500: primary.toLowerCase() };
  [50, 100, 200, 300, 400].forEach((step) => {
    palette[step] = oklchToHex([light[step], C * chroma[step], H]);
  });
  [600, 700, 800, 900].forEach((step) => {
    palette[step] = oklchToHex([Math.max(0.2, dark[step]), C * chroma[step], H]);
  });
  return palette;
};

/** Text on the main colour: white where it reads well, otherwise the dark heading colour */
const textOn = (background, dark) => (contrast(background, '#ffffff') >= 2.5 ? '#ffffff' : contrast(background, dark) >= 4 ? dark : '#111827');

// Tailwind's own slate shades, used when no text colour is chosen
const SLATE = { 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' };

/** Text shades from one text colour (it becomes the strong text, slate-800) */
const textShades = (ink) => ({
  400: mix(ink, '#ffffff', 0.58),
  500: mix(ink, '#ffffff', 0.42),
  600: mix(ink, '#ffffff', 0.28),
  700: mix(ink, '#ffffff', 0.13),
  800: ink.toLowerCase(),
  900: mix(ink, '#000000', 0.3),
  950: mix(ink, '#000000', 0.55),
});

/**
 * Every colour of a theme: { palette, heading, text, onBrand, mint, beige }.
 * `theme` is what the admin saved: { preset, primary, heading, text }.
 */
export function resolveTheme(theme) {
  const preset = findPreset(theme && theme.preset);
  const pick = (key) => (theme && isHexColor(theme[key]) ? theme[key].toLowerCase() : '');
  const customPrimary = pick('primary');

  const palette = customPrimary ? paletteFrom(customPrimary) : { ...(preset.palette || paletteFrom(preset.primary)) };
  const heading = pick('heading') || preset.heading || palette[800];
  palette[800] = heading;
  palette[900] = heading === (preset.palette && preset.palette[800]) ? preset.palette[900] : mix(heading, '#000000', 0.3);

  const text = pick('text') || preset.text || '';
  return {
    preset: preset.id,
    palette,
    heading,
    text: text || SLATE[800],
    customText: Boolean(text),
    onBrand: textOn(palette[500], heading),
    mint: palette[50],
    beige: customPrimary ? mix(palette[50], '#faf7f0', 0.5) : preset.beige,
  };
}

/** CSS variables for a resolved theme */
export function themeVariables(resolved) {
  const vars = {};
  Object.entries(resolved.palette).forEach(([step, value]) => {
    vars[`--color-brand-${step}`] = value;
  });
  vars['--color-on-brand'] = resolved.onBrand;
  vars['--color-mint'] = resolved.mint;
  vars['--color-beige'] = resolved.beige;
  const shades = resolved.customText ? textShades(resolved.text) : SLATE;
  Object.entries(shades).forEach(([step, value]) => {
    vars[`--color-slate-${step}`] = value;
  });
  return vars;
}

const CACHE_KEY = 'greenmart_theme_v1';
let appliedKeys = [];

/** Recolour the whole site. `theme` is the saved settings.theme (or a preview of it). */
export function applyTheme(theme, { remember = true } = {}) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(theme);
  const vars = themeVariables(resolved);
  const root = document.documentElement;
  appliedKeys.filter((key) => !(key in vars)).forEach((key) => root.style.removeProperty(key));
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  appliedKeys = Object.keys(vars);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved.palette[500]);

  if (remember) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(theme || {}));
    } catch {
      /* storage unavailable */
    }
  }
}

let savedTheme = null;
let previewing = null;

/** The theme saved in Store settings. Applied unless the admin is trying out another one. */
export function setSavedTheme(theme) {
  savedTheme = theme || {};
  if (!previewing) applyTheme(savedTheme);
}

/** Try a theme without saving it (Website colours page). null goes back to the saved theme. */
export function previewTheme(theme) {
  previewing = theme || null;
  if (previewing) applyTheme(previewing, { remember: false });
  else if (savedTheme) applyTheme(savedTheme);
}

/** Use the colours from the last visit straight away, before the settings arrive (no green flash) */
export function applyCachedTheme() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached) applyTheme(cached, { remember: false });
  } catch {
    /* ignore a broken cache */
  }
}
