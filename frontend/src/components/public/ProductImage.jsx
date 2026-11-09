import { useState } from 'react';
import { Leaf } from 'lucide-react';
import { imageUrl } from '../../utils/links';

/** Item photo with a soft leaf placeholder when there is no image (or it fails to load). */
export default function ProductImage({ src, alt, className = '', iconClass = 'size-10' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 ${className}`} role="img" aria-label={alt}>
        <Leaf className={`text-brand-300 ${iconClass}`} />
      </div>
    );
  }

  return <img src={imageUrl(src)} alt={alt} loading="lazy" className={`object-cover ${className}`} onError={() => setFailed(true)} />;
}
