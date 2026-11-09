/**
 * Decorative nature elements and small brand SVGs.
 */

/** Single leaf shape (inherits text colour) */
export function LeafShape({ className = '', style }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} fill="currentColor" aria-hidden="true">
      <path d="M56 6C31 6 11 21 11 42c0 4.2.9 8.1 2.4 11.6C17.6 40 27.6 29.2 40.8 23.8 30.4 31.2 22.6 41.6 19.2 54.4 23.2 56.6 27.6 58 32.4 58 51.6 58 60 37.6 56 6z" />
    </svg>
  );
}

/** Floating leaves for hero / section backgrounds (absolute, purely decorative). `still` = no movement. */
export function FloatingLeaves({ className = '', still = false }) {
  const move = still ? '' : 'animate-float';
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <LeafShape className={`absolute -left-6 top-10 size-24 rotate-[-20deg] text-brand-200/60 ${move}`} />
      <LeafShape className={`absolute right-[8%] top-6 size-14 rotate-[35deg] text-brand-300/50 ${move} [animation-delay:1.2s]`} />
      <LeafShape className={`absolute bottom-8 left-[42%] size-10 rotate-[120deg] text-brand-200/70 ${move} [animation-delay:2.4s]`} />
      <LeafShape className={`absolute -right-8 bottom-4 size-32 rotate-[200deg] text-brand-100 ${move} [animation-delay:0.6s]`} />
    </div>
  );
}

/** Wavy divider between sections */
export function WaveDivider({ className = 'text-white', flip = false }) {
  return (
    <svg
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className={`block h-8 w-full sm:h-12 ${flip ? 'rotate-180' : ''} ${className}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 32c120 18 240 28 360 24S600 26 720 22s240 6 360 16 240 14 360 6v22H0z" />
    </svg>
  );
}

const SOCIAL_PATHS = {
  facebook: (
    <path d="M13.5 21.5v-8h2.7l.4-3.2h-3.1V8.3c0-.9.3-1.6 1.6-1.6h1.7V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.4H7.7v3.2h2.7v8h3.1z" />
  ),
  instagram: (
    <>
      <path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
      <circle cx="17" cy="7" r="1.1" />
      <path d="M16.5 2.5h-9a5 5 0 0 0-5 5v9a5 5 0 0 0 5 5h9a5 5 0 0 0 5-5v-9a5 5 0 0 0-5-5zm3.3 14a3.3 3.3 0 0 1-3.3 3.3h-9a3.3 3.3 0 0 1-3.3-3.3v-9a3.3 3.3 0 0 1 3.3-3.3h9a3.3 3.3 0 0 1 3.3 3.3v9z" />
    </>
  ),
  youtube: (
    <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z" />
  ),
  twitter: (
    <path d="M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21H2.5l7.1-8.1L2 3h6.3l4.3 5.7L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
  ),
};

const SOCIAL_LABELS = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', twitter: 'X (Twitter)' };

/** Round social media buttons for the links that are filled in */
export function SocialLinks({ links = {}, className = '', buttonClass = 'bg-white text-brand-700 hover:bg-brand-500 hover:text-on-brand' }) {
  const entries = Object.entries(SOCIAL_PATHS).filter(([key]) => links[key]);
  if (!entries.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {entries.map(([key, path]) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={SOCIAL_LABELS[key]}
          title={SOCIAL_LABELS[key]}
          className={`flex size-9 items-center justify-center rounded-full shadow-card transition duration-200 hover:-translate-y-0.5 ${buttonClass}`}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            {path}
          </svg>
        </a>
      ))}
    </div>
  );
}

/** Instagram glyph */
export function InstagramIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      {SOCIAL_PATHS.instagram}
    </svg>
  );
}

/** WhatsApp glyph (lucide has no brand icons) */
export function WhatsAppIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 0 1 2.2 12C2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9a9.7 9.7 0 0 1 2.9 6.9c0 5.4-4.4 9.8-9.8 9.8zm8.4-18.2A11.8 11.8 0 0 0 12 .1C5.5.1.1 5.5.1 12c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.6c1.7.9 3.7 1.4 5.7 1.4 6.5 0 11.9-5.4 11.9-11.9 0-3.2-1.2-6.2-3.5-8.3z" />
    </svg>
  );
}
