import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

const BASE =
  'inline-flex items-center justify-center font-medium transition-all duration-200 select-none whitespace-nowrap ' +
  'focus:outline-none focus-visible:ring-4 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100';

const VARIANTS = {
  primary: 'bg-brand-500 text-on-brand shadow-soft hover:bg-brand-600 focus-visible:ring-brand-200',
  dark: 'bg-brand-800 text-white hover:bg-brand-900 focus-visible:ring-brand-200',
  secondary: 'bg-brand-50 text-brand-800 hover:bg-brand-100 focus-visible:ring-brand-100',
  outline: 'border border-brand-200 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-brand-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-slate-200',
  danger: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-200',
  'danger-outline': 'border border-red-200 bg-white text-red-600 hover:bg-red-50 focus-visible:ring-red-100',
  white: 'bg-white text-brand-800 shadow-card hover:bg-brand-50 focus-visible:ring-white/50',
  whatsapp: 'bg-[#25D366] text-white hover:bg-[#1ebe5b] focus-visible:ring-green-200',
};

const SIZES = {
  xs: 'gap-1 rounded-lg px-2.5 py-1.5 text-xs',
  sm: 'gap-1.5 rounded-xl px-3 py-2 text-sm',
  md: 'gap-2 rounded-xl px-4 py-2.5 text-sm',
  lg: 'gap-2 rounded-2xl px-6 py-3 text-base',
  icon: 'rounded-xl p-2',
};

const ICON_SIZES = { xs: 'size-3.5', sm: 'size-4', md: 'size-4', lg: 'size-5', icon: 'size-5' };

/**
 * Button that can also render as a router link (`to`) or anchor (`href`).
 *   <Button icon={Plus} onClick={...}>Add item</Button>
 *   <Button to="/order" size="lg">Order Now</Button>
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  to,
  href,
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const classes = [BASE, VARIANTS[variant] || VARIANTS.primary, SIZES[size] || SIZES.md, fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');
  const iconClass = ICON_SIZES[size] || ICON_SIZES.md;

  const content = (
    <>
      {loading ? <LoaderCircle className={`${iconClass} animate-spin`} /> : Icon && <Icon className={iconClass} />}
      {children}
      {IconRight && !loading && <IconRight className={iconClass} />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
}
