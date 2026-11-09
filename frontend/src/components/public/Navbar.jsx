import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, PackageSearch, ShoppingCart, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import Button from '../ui/Button';
import StoreLogo from './StoreLogo';

const NAV_LINKS = [
  { label: 'Home', to: '/', hash: '' },
  { label: 'Offers', to: '/#offers', hash: '#offers' },
  { label: 'About', to: '/#about', hash: '#about' },
  { label: 'Products', to: '/order' },
  { label: 'Gallery', to: '/#gallery', hash: '#gallery' },
  { label: 'Contact', to: '/#contact', hash: '#contact' },
];

export default function Navbar() {
  const { count } = useCart();
  const { offersEnabled } = useStore();
  // "Offers" only while offers are switched on in admin
  const links = NAV_LINKS.filter((link) => offersEnabled || link.hash !== '#offers');
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (link) => {
    if (link.hash !== undefined) return location.pathname === '/' && location.hash === link.hash;
    return location.pathname.startsWith(link.to);
  };

  /** Clicking a section link while already on the home page just scrolls. */
  const handleHashClick = (event, link) => {
    if (link.hash === undefined || location.pathname !== '/') return;
    const target = link.hash ? document.getElementById(link.hash.slice(1)) : null;
    if (!link.hash) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.history.replaceState(null, '', '/');
    } else if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `/${link.hash}`);
    }
    setMenuOpen(false);
  };

  const linkClass = (link) =>
    `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
      isActive(link) ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-brand-50/70 hover:text-brand-800'
    }`;

  return (
    <header
      className={`sticky top-0 z-30 border-b transition-all duration-300 ${
        scrolled ? 'border-brand-100 bg-white/90 shadow-card backdrop-blur-md' : 'border-transparent bg-white/70 backdrop-blur-sm'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <StoreLogo className="min-w-0 flex-1 lg:flex-none" />

        {/* Desktop links */}
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link key={link.label} to={link.to} onClick={(e) => handleHashClick(e, link)} className={linkClass(link)}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <NavLink
            to="/track"
            className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-800 md:inline-flex"
          >
            <PackageSearch className="size-4" />
            Track Order
          </NavLink>

          <Link
            to="/cart"
            className="relative flex size-10 items-center justify-center rounded-xl text-brand-800 transition hover:bg-brand-50"
            aria-label={`Cart with ${count} items`}
          >
            <ShoppingCart className="size-5" />
            {count > 0 && (
              <span
                key={count}
                className="absolute -right-0.5 -top-0.5 flex min-w-5 animate-bounce-in items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold leading-5 text-on-brand ring-2 ring-white"
              >
                {count}
              </span>
            )}
          </Link>

          {/* Wrapper controls visibility (the Button itself is always inline-flex) */}
          <div className="hidden sm:block">
            <Button to="/order" size="md">
              Order Now
            </Button>
          </div>

          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-xl text-brand-800 transition hover:bg-brand-50 lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="animate-fade-in border-t border-brand-100 bg-white px-4 pb-5 pt-3 shadow-card lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link key={link.label} to={link.to} onClick={(e) => handleHashClick(e, link)} className={`${linkClass(link)} py-3`}>
                {link.label}
              </Link>
            ))}
            <Link to="/track" className={`${linkClass({ to: '/track' })} flex items-center gap-2 py-3`}>
              <PackageSearch className="size-4" /> Track your order
            </Link>
          </div>
          <Button to="/order" size="lg" fullWidth className="mt-3">
            Order Now
          </Button>
        </div>
      )}
    </header>
  );
}
