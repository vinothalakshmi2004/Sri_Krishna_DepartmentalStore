import { Link } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { imageUrl, mailLink, mapsLink, telLink } from '../../utils/links';
import { LeafShape, SocialLinks } from './Decor';
import StoreLogo from './StoreLogo';

export default function Footer() {
  const { settings, storeName, offersEnabled } = useStore();
  const s = settings || {};
  const phones = [s.phone, ...(s.extraPhones || [])].filter(Boolean);

  return (
    <footer className="relative overflow-hidden bg-beige">
      <LeafShape className="pointer-events-none absolute -right-10 -top-10 size-48 rotate-[200deg] text-brand-100" />
      {/* Phones: brand on top, quick links | hours side by side, contact full width */}
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="order-1 col-span-2 lg:col-span-1">
          {s.logoFull ? (
            <Link to="/" className="inline-block">
              <img src={imageUrl(s.logoFull)} alt={storeName} className="h-24 w-auto max-w-full rounded-2xl bg-white object-contain p-2 shadow-card" />
            </Link>
          ) : (
            <StoreLogo />
          )}
          {s.tagline && <p className="mt-3 text-sm text-slate-600">{s.tagline}</p>}
          <SocialLinks links={s.socialLinks} className="mt-4" />
        </div>

        <div className="order-2">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Quick links</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ['Home', '/'],
              ...(offersEnabled ? [["Today's offers", '/#offers']] : []),
              ['Shop products', '/order'],
              ['My cart', '/cart'],
              ['Track your order', '/track'],
              ['About us', '/#about'],
              ['Contact', '/#contact'],
            ].map(([label, to]) => (
              <li key={label}>
                <Link to={to} className="text-slate-600 transition hover:text-brand-700">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="order-4 col-span-2 lg:order-3 lg:col-span-1">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Contact</h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {phones.map((number) => (
              <li key={number}>
                <a href={telLink(number)} className="flex items-start gap-2.5 transition hover:text-brand-700">
                  <Phone className="mt-0.5 size-4 shrink-0 text-brand-600" /> {number}
                </a>
              </li>
            ))}
            {s.email && (
              <li>
                <a href={mailLink(s.email)} className="flex items-start gap-2.5 break-all transition hover:text-brand-700">
                  <Mail className="mt-0.5 size-4 shrink-0 text-brand-600" /> {s.email}
                </a>
              </li>
            )}
            {s.address && (
              <li>
                <a
                  href={s.mapLink || mapsLink(s.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 transition hover:text-brand-700"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" /> {s.address}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div className="order-3 lg:order-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider">Opening hours</h4>
          <p className="mt-4 flex items-start gap-2.5 text-sm text-slate-600">
            <Clock className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <span className="whitespace-pre-line">{s.openingHours || 'Open all days'}</span>
          </p>
        </div>
      </div>

      <div className="relative border-t border-brand-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>
          <Link to="/admin/login" className="transition hover:text-brand-700">
            Staff login
          </Link>
        </div>
      </div>
    </footer>
  );
}
