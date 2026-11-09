/**
 * Landing page. Every piece of store content (name, about, contact, gallery,
 * map, hours, delivery rules) comes from GET /api/public/settings, so changes
 * made in the admin panel show up here automatically.
 */
import { useMemo, useState } from 'react';
import {
  Apple,
  ArrowRight,
  BadgeIndianRupee,
  Banknote,
  Carrot,
  Clock,
  Egg,
  House,
  Images,
  Mail,
  MapPin,
  Milk,
  PackageSearch,
  Phone,
  ShoppingBasket,
  Sprout,
  Timer,
  Truck,
  Wheat,
  WifiOff,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { publicApi } from '../../api/publicApi';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatCurrency } from '../../utils/format';
import { deliveryRule } from '../../utils/pricing';
import { enquiryWhatsappMessage, imageUrl, mailLink, mapsLink, telLink, whatsappLink } from '../../utils/links';
import Button from '../../components/ui/Button';
import { ProductGridSkeleton, Skeleton } from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import ProductCard from '../../components/public/ProductCard';
import SectionHeading from '../../components/public/SectionHeading';
import StoreStatusBadge from '../../components/public/StoreStatusBadge';
import Lightbox from '../../components/public/Lightbox';
import OfferZone from '../../components/public/OfferZone';
import { FloatingLeaves, InstagramIcon, LeafShape, WaveDivider, WhatsAppIcon } from '../../components/public/Decor';
import LandingAnimation, { resolveAnimation } from '../../components/public/LandingAnimation';
import Reveal from '../../components/public/Reveal';

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
/** Delivery rules from Store Settings, e.g. "Free home delivery" + "Orders of ₹1,000 & above" */
function DeliveryChips({ settings }) {
  if (!settings) return null;
  const charge = Number(settings.deliveryCharge) || 0;
  const freeAbove = Number(settings.freeDeliveryAbove) || 0;
  const minOrder = Number(settings.minOrderAmount) || 0;

  const chips = [];
  if (charge === 0) {
    chips.push({ icon: Truck, text: 'Free home delivery' });
  } else {
    chips.push({ icon: House, text: `Delivery ${formatCurrency(charge)}` });
    if (freeAbove > 0) chips.push({ icon: Truck, text: `Free delivery above ${formatCurrency(freeAbove)}` });
  }
  if (minOrder > 0) chips.push({ icon: ShoppingBasket, text: `Orders of ${formatCurrency(minOrder)} & above` });
  chips.push({ icon: Banknote, text: 'Pay on delivery' });

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {chips.map(({ icon: Icon, text }) => (
        <span key={text} className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-card">
          <Icon className="size-3.5 text-brand-600" /> {text}
        </span>
      ))}
    </div>
  );
}

function HeroVisual({ heroImage, storeName, animate }) {
  const [failed, setFailed] = useState(false);

  if (heroImage && !failed) {
    return (
      // Kept smaller than the column so the picture does not dominate the page
      <div className={`relative mx-auto w-full max-w-[18rem] sm:max-w-sm lg:max-w-md ${animate ? 'hero-float' : ''}`}>
        <div className="anim-tint absolute -inset-3 rotate-2 rounded-[2.5rem]" aria-hidden="true" />
        <img
          src={imageUrl(heroImage)}
          alt={storeName}
          className="relative aspect-[4/3] w-full rounded-[2rem] object-cover shadow-soft"
          onError={() => setFailed(true)}
        />
        <div className="absolute -bottom-5 left-5 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-soft">
          <Sprout className="size-5 text-brand-500" />
          <span className="text-sm font-semibold text-brand-800">Fresh every day</span>
        </div>
      </div>
    );
  }

  // Illustration when no hero image is uploaded yet
  const produce = [
    { icon: Carrot, className: 'left-[8%] top-[12%] bg-orange-50 text-orange-500' },
    { icon: Apple, className: 'right-[10%] top-[8%] bg-red-50 text-red-500 [animation-delay:1s]' },
    { icon: Milk, className: 'left-[4%] bottom-[18%] bg-sky-50 text-sky-500 [animation-delay:2s]' },
    { icon: Wheat, className: 'right-[6%] bottom-[14%] bg-amber-50 text-amber-500 [animation-delay:1.5s]' },
    { icon: Egg, className: 'left-[42%] -top-2 bg-yellow-50 text-yellow-600 [animation-delay:0.5s]' },
  ];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[18rem] sm:max-w-sm">
      <div className="absolute inset-[10%] rounded-full bg-gradient-to-br from-brand-300 to-brand-500 shadow-soft" />
      <div className="absolute inset-[18%] flex items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-white">
        <ShoppingBasket className="size-1/3 text-brand-600" strokeWidth={1.4} />
      </div>
      {produce.map(({ icon: Icon, className }) => (
        <span key={className} className={`absolute flex size-12 items-center justify-center rounded-2xl shadow-soft sm:size-14 ${animate ? 'animate-float' : ''} ${className}`}>
          <Icon className="size-7" />
        </span>
      ))}
    </div>
  );
}

function Hero({ settings, storeName, loading, animation }) {
  // Shapes wait for the settings, so the admin's chosen style shows without a flash of another one
  const showShapes = Boolean(settings) && animation.enabled;
  const whatsapp = settings && (settings.whatsapp || settings.phone);
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-beige"
      style={animation.color ? { '--anim-color': animation.color } : undefined}
    >
      {showShapes ? <LandingAnimation style={animation.style} color={animation.color} /> : <FloatingLeaves still={!animation.enabled} />}
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-2 md:gap-12 md:pb-24 md:pt-16 lg:px-8">
        <div className="animate-slide-up">
          <StoreStatusBadge />
          {loading ? (
            <>
              <Skeleton className="mt-5 h-12 w-3/4" />
              <Skeleton className="mt-4 h-5 w-full max-w-md" />
            </>
          ) : (
            <>
              <h1 className="mt-5 text-[2rem] font-extrabold leading-[1.15] tracking-tight min-[400px]:text-4xl sm:text-5xl lg:text-6xl">
                {storeName}
              </h1>
              <p className="mt-4 max-w-lg text-base text-slate-600 sm:text-lg">
                {settings?.tagline || 'Fresh groceries and daily essentials, delivered to your doorstep.'}
              </p>
            </>
          )}
          {/* Buttons share the row on phones and stack only when the screen is too narrow */}
          <div className="mt-7 flex flex-wrap gap-3">
            <Button to="/order" size="lg" iconRight={ArrowRight} className="flex-auto shadow-lg sm:flex-none">
              Order Now
            </Button>
            <Button to="/track" size="lg" variant="outline" icon={PackageSearch} className="flex-auto sm:flex-none">
              Track Order
            </Button>
            {whatsapp && (
              <Button
                href={whatsappLink(whatsapp, enquiryWhatsappMessage(storeName))}
                target="_blank"
                rel="noopener noreferrer"
                size="lg"
                variant="whatsapp"
                icon={WhatsAppIcon}
                className="flex-auto shadow-lg sm:flex-none"
                aria-label={`Send an enquiry to ${storeName} on WhatsApp`}
              >
                WhatsApp
              </Button>
            )}
          </div>
          <DeliveryChips settings={settings} />
        </div>
        <div className="animate-pop [animation-delay:150ms]">
          <HeroVisual heroImage={settings?.heroImage} storeName={storeName} animate={animation.enabled} />
        </div>
      </div>
      <WaveDivider className="absolute inset-x-0 bottom-0 text-white" />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* About + Why choose us                                               */
/* ------------------------------------------------------------------ */
/** Icon-only Instagram button (Contact section). The Instagram ID comes from Admin -> Store Settings. */
function InstagramButton({ settings, storeName }) {
  const instagram = settings?.socialLinks?.instagram;
  if (!instagram) return null;
  return (
    <a
      href={instagram}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${storeName} on Instagram`}
      title="Instagram"
      className="flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-200"
      style={{ background: 'linear-gradient(45deg, #f9ce34, #ee2a7b 55%, #6228d7)' }}
    >
      <InstagramIcon className="size-6" />
    </a>
  );
}

function About({ settings, storeName }) {
  const photo = settings?.galleryImages?.[0];
  return (
    <section id="about" className="overflow-hidden bg-white py-16 sm:py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 md:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="relative order-2 md:order-1">
          <LeafShape className="absolute -left-6 -top-6 size-24 text-brand-100" />
          {photo ? (
            <img src={imageUrl(photo)} alt={`Inside ${storeName}`} className="relative aspect-[5/4] w-full rounded-[2rem] object-cover shadow-soft" loading="lazy" />
          ) : (
            <div className="relative grid aspect-[5/4] grid-cols-2 gap-4 rounded-[2rem] bg-mint p-6">
              {[Carrot, Apple, Milk, Wheat].map((Icon) => (
                <div key={Icon.displayName || Icon.name} className="flex items-center justify-center rounded-2xl bg-white shadow-card">
                  <Icon className="size-12 text-brand-500" strokeWidth={1.5} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="order-1 md:order-2">
          <SectionHeading eyebrow="About us" title={`Welcome to ${storeName}`} align="left" />
          <p className="mt-5 whitespace-pre-line leading-relaxed text-slate-600">
            {settings?.about ||
              'We are your friendly neighbourhood departmental store, bringing you fresh produce and daily essentials at honest prices.'}
          </p>
          {settings?.openingHours && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-beige px-4 py-2.5 text-sm font-medium text-brand-800">
              <Clock className="size-4" /> {settings.openingHours}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function WhyChooseUs({ settings }) {
  const rule = deliveryRule(settings);
  const features = [
    { icon: Sprout, title: 'Fresh Products', text: 'Handpicked vegetables, fruits and essentials, restocked every day.' },
    { icon: Timer, title: 'Fast Delivery', text: 'Quick delivery from our store straight to your doorstep.' },
    { icon: BadgeIndianRupee, title: 'Best Price', text: 'Fair everyday prices with no hidden charges.' },
    {
      icon: House,
      title: 'Home Delivery',
      text: rule ? `${rule}. Pay on delivery with Cash or GPay.` : 'Order from home, pay on delivery with Cash or GPay.',
    },
  ];

  return (
    <section className="relative bg-mint py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Why choose us" title="Goodness you can trust" subtitle="Everything your kitchen needs, with the care of a local store." />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          {features.map(({ icon: Icon, title, text }, index) => (
            <div
              key={title}
              className="group animate-slide-up rounded-2xl bg-white p-4 text-center shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-soft sm:p-6"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition duration-300 group-hover:rotate-6 group-hover:bg-brand-500 group-hover:text-on-brand sm:size-14">
                <Icon className="size-6 sm:size-7" />
              </span>
              <h3 className="mt-3 text-sm font-semibold sm:mt-4 sm:text-lg">{title}</h3>
              <p className="mt-1 text-xs text-slate-600 sm:mt-2 sm:text-sm">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Featured products                                                    */
/* ------------------------------------------------------------------ */
function FeaturedProducts({ isStoreOpen }) {
  const { data: items, loading, error, refetch } = useFetch(() => publicApi.getItems(), []);

  // Prefer items in stock, keep the store's order otherwise
  const featured = useMemo(() => {
    const list = items || [];
    return [...list.filter((i) => i.stock > 0), ...list.filter((i) => !(i.stock > 0))].slice(0, 6);
  }, [items]);

  return (
    <section id="products" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <SectionHeading eyebrow="Featured" title="Fresh picks for you" align="left" />
          <Button to="/order" variant="outline" iconRight={ArrowRight}>
            View all products
          </Button>
        </div>

        <div className="mt-8">
          {loading && <ProductGridSkeleton count={6} />}
          {!loading && error && (
            <EmptyState
              icon={WifiOff}
              title="Could not load products"
              message={error}
              action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>}
            />
          )}
          {!loading && !error && featured.length === 0 && (
            <EmptyState icon={ShoppingBasket} title="Products coming soon" message="Our shelves are being stocked. Please check back shortly." />
          )}
          {!loading && !error && featured.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
              {featured.map((item) => (
                <ProductCard key={item._id} item={item} storeClosed={!isStoreOpen} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                              */
/* ------------------------------------------------------------------ */
function Gallery({ images = [] }) {
  const [index, setIndex] = useState(null);

  return (
    <section id="gallery" className="bg-beige py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Gallery" title="A peek inside our store" />
        {images.length === 0 ? (
          <EmptyState icon={Images} title="Photos coming soon" message="We will share pictures of our store here." className="mt-6" />
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setIndex(i)}
                className={`group relative overflow-hidden rounded-2xl bg-white shadow-card focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${
                  i === 0 && images.length > 4 ? 'md:col-span-2 md:row-span-2' : ''
                }`}
                aria-label={`Open photo ${i + 1}`}
              >
                <img
                  src={imageUrl(src)}
                  alt={`Store photo ${i + 1}`}
                  loading="lazy"
                  className="aspect-square size-full object-cover transition duration-500 group-hover:scale-110"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-brand-900/40 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>
      <Lightbox images={images} index={index} onClose={() => setIndex(null)} onChange={setIndex} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Contact                                                              */
/* ------------------------------------------------------------------ */
function ContactCard({ icon: Icon, title, children, href, external }) {
  const inner = (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-card transition duration-200 hover:border-brand-200 hover:shadow-soft">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {/* overflow-wrap:anywhere lets a long email break on very small phones */}
        <div className="mt-0.5 text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">{children}</div>
      </div>
    </div>
  );
  if (!href) return inner;
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="block">
      {inner}
    </a>
  );
}

function Contact({ settings, storeName }) {
  const s = settings || {};
  const whatsapp = s.whatsapp || s.phone;
  const phones = [s.phone, ...(s.extraPhones || [])].filter(Boolean);
  // Exact store pin from Store Settings, otherwise a search for the address
  const directions = s.mapLink || (s.address ? mapsLink(s.address) : '');

  return (
    <section id="contact" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Contact" title="Visit or call us" subtitle="We are happy to help with your orders and questions." />

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {phones.length === 1 && (
              <ContactCard icon={Phone} title="Call us" href={telLink(phones[0])}>
                {phones[0]}
              </ContactCard>
            )}
            {phones.length > 1 && (
              <ContactCard icon={Phone} title="Call us">
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  {phones.map((number) => (
                    <a key={number} href={telLink(number)} className="text-brand-800 underline-offset-2 hover:text-brand-600 hover:underline">
                      {number}
                    </a>
                  ))}
                </span>
              </ContactCard>
            )}
            {s.email && (
              <ContactCard icon={Mail} title="Email" href={mailLink(s.email)}>
                {s.email}
              </ContactCard>
            )}
            {s.address && (
              <ContactCard icon={MapPin} title="Address" href={directions} external>
                {s.address}
              </ContactCard>
            )}
            {s.openingHours && (
              <ContactCard icon={Clock} title="Opening hours">
                <span className="whitespace-pre-line">{s.openingHours}</span>
              </ContactCard>
            )}
            {/* Order: Chat on WhatsApp, Instagram icon, Call now */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {whatsapp && (
                <Button
                  href={whatsappLink(whatsapp, enquiryWhatsappMessage(storeName))}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="whatsapp"
                  size="lg"
                  icon={WhatsAppIcon}
                  className="flex-auto sm:flex-none"
                >
                  Chat on WhatsApp
                </Button>
              )}
              <InstagramButton settings={settings} storeName={storeName} />
              {s.phone && (
                <Button href={telLink(s.phone)} variant="outline" size="lg" icon={Phone} className="flex-auto sm:flex-none">
                  Call now
                </Button>
              )}
            </div>
          </div>

          <div>
            <div className="h-[320px] overflow-hidden rounded-[2rem] bg-mint shadow-card sm:h-[380px] lg:h-full lg:min-h-[420px]">
              {s.mapEmbedUrl ? (
                <iframe
                  src={s.mapEmbedUrl}
                  title={`${storeName} location`}
                  className="size-full border-0"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <MapPin className="size-10 text-brand-500" />
                  <p className="font-medium text-slate-700">{s.address || 'Find us in your neighbourhood'}</p>
                </div>
              )}
            </div>
            {directions && (
              <Button href={directions} target="_blank" rel="noopener noreferrer" variant="outline" icon={MapPin} fullWidth className="mt-3">
                Get directions in Google Maps
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export default function Home() {
  const { settings, loading, error, storeName, isStoreOpen, offersEnabled, refresh } = useStore();
  useDocumentTitle(settings?.tagline ? `${storeName} - ${settings.tagline}` : storeName, '');
  const animation = resolveAnimation(settings?.animation);
  const reveal = animation.enabled;

  return (
    <>
      {error && !settings && (
        <div className="bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          {error}{' '}
          <button type="button" onClick={refresh} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}
      <Hero settings={settings} storeName={storeName} loading={loading} animation={animation} />
      {/* Offer Zone only while offers are switched on in Admin -> Offers */}
      {offersEnabled && (
        <Reveal enabled={reveal}>
          <OfferZone />
        </Reveal>
      )}
      <Reveal enabled={reveal}>
        <About settings={settings} storeName={storeName} />
      </Reveal>
      <Reveal enabled={reveal}>
        <WhyChooseUs settings={settings} />
      </Reveal>
      <Reveal enabled={reveal}>
        <FeaturedProducts isStoreOpen={isStoreOpen} />
      </Reveal>
      <Reveal enabled={reveal}>
        <Gallery images={settings?.galleryImages || []} />
      </Reveal>
      <Reveal enabled={reveal}>
        <Contact settings={settings} storeName={storeName} />
      </Reveal>
    </>
  );
}
