import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileCartBar from './MobileCartBar';
import { useCart } from '../../context/CartContext';

// Pages with their own checkout buttons do not need the floating cart bar
const HIDE_CART_BAR = ['/cart', '/checkout', '/order-success'];

/** Scroll to #section links, otherwise to the top on every page change */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Give the page a moment to render the section
      const timer = setTimeout(() => {
        const target = document.getElementById(hash.slice(1));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return () => clearTimeout(timer);
    }
    // "instant" overrides the global smooth scrolling for page changes
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return undefined;
  }, [pathname, hash]);

  return null;
}

export default function PublicLayout() {
  const { pathname } = useLocation();
  const { count } = useCart();
  const showCartBar = count > 0 && !HIDE_CART_BAR.some((path) => pathname.startsWith(path));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ScrollManager />
      <Navbar />
      <main className={`flex-1 ${showCartBar ? 'pb-24 md:pb-0' : ''}`}>
        <Outlet />
      </main>
      <Footer />
      {showCartBar && <MobileCartBar />}
    </div>
  );
}
