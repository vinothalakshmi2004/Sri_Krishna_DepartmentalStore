import { House, ShoppingBasket } from 'lucide-react';
import Button from '../components/ui/Button';
import { LeafShape } from '../components/public/Decor';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-beige px-4">
      <LeafShape className="absolute -left-10 top-10 size-40 rotate-[-20deg] text-brand-100" />
      <LeafShape className="absolute -right-10 bottom-10 size-52 rotate-[160deg] text-brand-100" />
      <div className="relative text-center">
        <p className="text-7xl font-extrabold text-brand-500 sm:text-8xl">404</p>
        <h1 className="mt-4 text-2xl font-bold">This page wandered off</h1>
        <p className="mt-2 text-slate-600">The page you are looking for does not exist or was moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/" icon={House}>
            Go home
          </Button>
          <Button to="/order" variant="outline" icon={ShoppingBasket}>
            Shop products
          </Button>
        </div>
      </div>
    </div>
  );
}
