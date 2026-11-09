/**
 * Website colours: pick one of five colour themes and fine-tune the main,
 * heading and text colours, plus the landing page animation (style, colour,
 * on/off). Every change is previewed live on the admin panel; Save makes it
 * the look of the whole website for customers too.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Check, Heading, Leaf, Palette, RotateCcw, Save, ShoppingCart, Sparkles, Type } from 'lucide-react';
import { settingsApi } from '../../api/adminApi';
import { getErrorMessage } from '../../api/client';
import { useStore } from '../../context/StoreContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { THEME_PRESETS, contrast, isHexColor, previewTheme, resolveTheme, setSavedTheme } from '../../utils/theme';
import PageHeader from '../../components/admin/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input, Toggle } from '../../components/ui/FormControls';
import PageLoader from '../../components/ui/Loader';
import LandingAnimation, { ANIMATION_STYLES, resolveAnimation } from '../../components/public/LandingAnimation';

const THEME_KEYS = ['preset', 'primary', 'heading', 'text'];
const EMPTY = { preset: 'green', primary: '', heading: '', text: '' };

const normalise = (theme) => Object.fromEntries(THEME_KEYS.map((key) => [key, (theme && theme[key]) || EMPTY[key]]));
const sameTheme = (a, b) => THEME_KEYS.every((key) => a[key] === b[key]);
const sameAnimation = (a, b) => a.enabled === b.enabled && a.style === b.style && a.color === b.color;

const ANIMATION_COLOR_FIELD = {
  key: 'animationColor',
  label: 'Animation colour',
  hint: 'Colour of the moving shapes on the home page',
  icon: Sparkles,
  warn: () => '',
};

const COLOR_FIELDS = [
  {
    key: 'primary',
    label: 'Main colour',
    hint: 'Buttons, links, prices and highlights',
    icon: Palette,
    warn: (c) => (contrast(c, '#ffffff') < 1.4 ? 'This colour is very light - buttons and highlights will be hard to see on white pages.' : ''),
  },
  {
    key: 'heading',
    label: 'Heading colour',
    hint: 'Titles and dark buttons',
    icon: Heading,
    warn: (c) => (contrast(c, '#ffffff') < 4.5 ? 'Light heading colours are hard to read on white. Pick a darker colour.' : ''),
  },
  {
    key: 'text',
    label: 'Text colour',
    hint: 'Paragraphs, labels and descriptions',
    icon: Type,
    warn: (c) => (contrast(c, '#ffffff') < 7 ? 'Paragraph text should be dark so it stays easy to read. Pick a darker colour.' : ''),
  },
];

/** A preset drawn in its own colours (not the current theme), like a tiny website */
function PresetCard({ preset, selected, onSelect }) {
  const colours = useMemo(() => resolveTheme({ preset: preset.id }), [preset.id]);
  const main = colours.palette[500];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-card ${
        selected ? 'border-brand-500 shadow-soft' : 'border-slate-100'
      }`}
    >
      <div className="p-3" style={{ background: colours.beige }}>
        <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: main, color: colours.onBrand }}>
          <span className="text-[11px] font-bold">Sri Krishna</span>
          <ShoppingCart className="size-3.5" />
        </div>
        <p className="mt-2.5 text-sm font-bold leading-tight" style={{ color: colours.heading }}>
          Fresh groceries
        </p>
        <p className="text-[11px] leading-snug" style={{ color: colours.text }}>
          Delivered to your doorstep
        </p>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-md px-2 py-1 text-[10px] font-semibold" style={{ background: main, color: colours.onBrand }}>
            Order now
          </span>
          <span className="rounded-md border bg-white px-2 py-1 text-[10px] font-semibold" style={{ borderColor: colours.palette[200], color: colours.heading }}>
            Offers
          </span>
        </div>
      </div>
      <div className="flex flex-1 items-start justify-between gap-2 border-t border-slate-100 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{preset.name}</p>
          <p className="text-xs text-slate-500">{preset.description}</p>
        </div>
        <div className="flex shrink-0 -space-x-1.5 pt-0.5">
          {[main, colours.palette[300], colours.heading].map((c) => (
            <span key={c} className="size-4 rounded-full ring-2 ring-white" style={{ background: c }} />
          ))}
        </div>
      </div>
      {selected && (
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-brand-500 text-on-brand shadow">
          <Check className="size-4" />
        </span>
      )}
    </button>
  );
}

/** Colour picker + hex box for one fine-tunable colour */
function ColourField({ field, custom, effective, onChange }) {
  const [typed, setTyped] = useState(effective);
  useEffect(() => setTyped(effective), [effective]);
  const warning = field.warn(effective);
  const Icon = field.icon;

  const type = (value) => {
    const raw = value.trim();
    setTyped(raw);
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (isHexColor(hex)) onChange(hex.toLowerCase());
  };

  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 shadow-sm" style={{ background: effective }}>
          <input
            type="color"
            value={effective}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`Pick the ${field.label.toLowerCase()}`}
          />
        </label>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
            <Icon className="size-3.5 text-brand-600" /> {field.label}
          </p>
          <p className="text-xs text-slate-500">{field.hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-28">
            <Input
              value={typed}
              onChange={(e) => type(e.target.value)}
              onBlur={() => setTyped(effective)}
              maxLength={7}
              spellCheck={false}
              className="font-mono uppercase"
              aria-label={`${field.label} code`}
            />
          </div>
          {custom ? (
            <Button size="xs" variant="ghost" icon={RotateCcw} onClick={() => onChange('')} title="Use the theme's own colour">
              Reset
            </Button>
          ) : (
            <span className="w-14 text-center text-[11px] text-slate-400">From theme</span>
          )}
        </div>
      </div>
      {warning && (
        <p className="mt-2 flex gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {warning}
        </p>
      )}
    </div>
  );
}

/** A slice of the customer website drawn with the live theme colours */
function SitePreview({ storeName }) {
  const products = [
    ['Ponni Raw Rice', '1 kg', '₹62'],
    ['Toor Dal', '1 kg', '₹145'],
    ['Sunflower Oil', '1 litre', '₹165'],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-on-brand">
            <Leaf className="size-4" />
          </span>
          <span className="truncate font-bold text-brand-800">{storeName}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden font-medium text-brand-700 sm:inline">Home</span>
          <span className="hidden text-slate-600 sm:inline">Offers</span>
          <span className="relative text-slate-600">
            <ShoppingCart className="size-5" />
            <span className="absolute -right-2 -top-2 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold leading-4 text-on-brand">3</span>
          </span>
        </div>
      </div>
      <div className="bg-gradient-to-br from-brand-50 via-white to-beige p-4 sm:p-6">
        <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">Today's offers</span>
        <h2 className="mt-3 text-xl font-bold sm:text-2xl">Fresh groceries at your doorstep</h2>
        <p className="mt-1 text-sm text-slate-600">Rice, dals, oils and daily needs - free home delivery on orders of ₹1000 and above.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm">Order now</Button>
          <Button size="sm" variant="outline">
            View offers
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map(([name, unit, price], i) => (
            <div key={name} className={`rounded-xl border border-slate-100 bg-white p-3 shadow-card ${i === 2 ? 'hidden sm:block' : ''}`}>
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-mint">
                <Leaf className="size-6 text-brand-300" />
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-slate-800">{name}</p>
              <p className="text-xs text-slate-500">{unit}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-bold text-brand-700">{price}</span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-on-brand">+</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Landing page animation: on/off, style and colour, with live previews */
function AnimationCard({ animation, mainColour, onChange }) {
  const effectiveColour = animation.color || mainColour;
  return (
    <Card
      title="Landing page animation"
      description="Moving shapes behind the top of the home page, and sections that slide in while scrolling"
      icon={Sparkles}
      bodyClassName="space-y-4 p-4 sm:p-5"
    >
      <Toggle
        checked={animation.enabled}
        onChange={(enabled) => onChange({ enabled })}
        label="Show animation on the home page"
        description="Turn off for a calm, still page. Phones set to reduce motion never see it."
      />

      <div className={`space-y-4 transition ${animation.enabled ? '' : 'pointer-events-none opacity-50'}`}>
        <div className="grid gap-3 sm:grid-cols-3">
          {ANIMATION_STYLES.map((item) => {
            const selected = animation.style === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange({ style: item.id })}
                aria-pressed={selected}
                disabled={!animation.enabled}
                className={`relative overflow-hidden rounded-2xl border-2 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-card ${
                  selected ? 'border-brand-500 shadow-soft' : 'border-slate-100'
                }`}
              >
                <div className="relative h-24 overflow-hidden bg-gradient-to-br from-brand-50 via-white to-beige">
                  {animation.enabled && <LandingAnimation style={item.id} color={animation.color} compact />}
                </div>
                <div className="border-t border-slate-100 p-3">
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                {selected && (
                  <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-brand-500 text-on-brand shadow">
                    <Check className="size-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <ColourField
          field={ANIMATION_COLOR_FIELD}
          custom={Boolean(animation.color)}
          effective={effectiveColour}
          onChange={(value) => onChange({ color: value })}
        />
        {!animation.color && <p className="-mt-2 text-xs text-slate-500">Follows the main website colour until you pick one.</p>}
      </div>

      {/* Bigger live preview, like the top of the home page */}
      <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-brand-50 via-white to-beige">
        {animation.enabled && <LandingAnimation style={animation.style} color={animation.color} />}
        <div className="relative text-center">
          <p className="text-lg font-bold text-brand-800">Home page preview</p>
          <p className="text-xs text-slate-500">{animation.enabled ? 'This is how the animation moves' : 'Animation is turned off'}</p>
          <span className="mt-3 inline-flex rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-on-brand shadow-soft">Order Now</span>
        </div>
      </div>
    </Card>
  );
}

export default function WebsiteColours() {
  useDocumentTitle('Website colours');
  const { settings, loading, refresh, storeName } = useStore();
  const saved = useMemo(() => normalise(settings && settings.theme), [settings]);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const current = draft || saved;
  const themeDirty = Boolean(draft) && !sameTheme(draft, saved);
  const resolved = useMemo(() => resolveTheme(current), [current]);

  const savedAnimation = useMemo(() => resolveAnimation(settings && settings.animation), [settings]);
  const [animationDraft, setAnimationDraft] = useState(null);
  const currentAnimation = animationDraft || savedAnimation;
  const animationDirty = Boolean(animationDraft) && !sameAnimation(animationDraft, savedAnimation);
  const dirty = themeDirty || animationDirty;
  const changeAnimation = (patch) => setAnimationDraft((prev) => ({ ...(prev || savedAnimation), ...patch }));
  const undo = () => {
    setDraft(null);
    setAnimationDraft(null);
  };

  // Show the colours on the whole admin panel while choosing; leaving the page goes back to the saved ones
  useEffect(() => {
    previewTheme(themeDirty ? draft : null);
  }, [draft, themeDirty]);
  useEffect(() => () => previewTheme(null), []);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (patch) => setDraft((prev) => ({ ...(prev || saved), ...patch }));
  // A new theme starts from its own colours
  const choosePreset = (id) => change({ preset: id, primary: '', heading: '', text: '' });

  const save = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update({ theme: current, animation: currentAnimation });
      setSavedTheme(res.data.theme);
      setDraft(null);
      setAnimationDraft(null);
      await refresh();
      toast.success('Website colours and animation saved - customers see them now');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings) return <PageLoader label="Loading colours..." />;

  const effective = { primary: resolved.palette[500], heading: resolved.heading, text: resolved.text };
  const presetName = THEME_PRESETS.find((p) => p.id === current.preset).name;
  const customised = COLOR_FIELDS.some((f) => current[f.key]);

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        title="Website colours"
        description="Choose the colours of the whole website and admin panel. Changes show here straight away - press Save so customers see them too."
        actions={
          <>
            {dirty && (
              <Button variant="ghost" icon={RotateCcw} onClick={undo} disabled={saving}>
                Undo changes
              </Button>
            )}
            <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>
              Save colours
            </Button>
          </>
        }
      />

      <Card title="Colour themes" description="Pick a ready-made colour theme" icon={Palette} bodyClassName="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {THEME_PRESETS.map((preset) => (
            <PresetCard key={preset.id} preset={preset} selected={current.preset === preset.id} onSelect={() => choosePreset(preset.id)} />
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card
          title="Fine-tune colours"
          description={customised ? `${presetName} with your own colours` : `Using the ${presetName} colours`}
          icon={Type}
          bodyClassName="space-y-3 p-4 sm:p-5"
        >
          {COLOR_FIELDS.map((field) => (
            <ColourField
              key={field.key}
              field={field}
              custom={Boolean(current[field.key])}
              effective={effective[field.key]}
              onChange={(value) => change({ [field.key]: value })}
            />
          ))}
          <p className="text-xs text-slate-500">
            Text on buttons switches between white and dark by itself, so it stays readable on light colours like gold.
          </p>
        </Card>

        <Card title="Preview" description="How the customer website looks with these colours" icon={Leaf} bodyClassName="p-4 sm:p-5">
          <SitePreview storeName={storeName} />
        </Card>
      </div>

      <AnimationCard animation={currentAnimation} mainColour={resolved.palette[500]} onChange={changeAnimation} />

      {dirty && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-soft backdrop-blur">
          <p className="text-sm text-slate-600">These changes are only a preview until you save them.</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={undo} disabled={saving}>
              Undo
            </Button>
            <Button icon={Save} onClick={save} loading={saving}>
              Save colours
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
