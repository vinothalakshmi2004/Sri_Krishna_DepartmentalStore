import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import Button from '../ui/Button';
import QuantityControl from './QuantityControl';

/**
 * "Add to Cart" button that turns into compact +/- controls once the item is
 * in the cart. Sized to fit 2-column product grids on the narrowest phones
 * (the cart icon is hidden below 360px wide).
 */
export default function CartAction({ item, storeClosed = false }) {
  const { getQuantity, addItem, increment, decrement } = useCart();
  const quantity = getQuantity(item._id);
  const outOfStock = !(item.stock > 0);

  if (quantity > 0) {
    return (
      <QuantityControl
        compact
        size="sm"
        className="h-10"
        quantity={quantity}
        unit={item.unit}
        onIncrement={() => increment(item._id)}
        onDecrement={() => decrement(item._id)}
        disabled={storeClosed}
      />
    );
  }

  return (
    <Button
      fullWidth
      size="sm"
      icon={outOfStock ? undefined : ShoppingCart}
      variant={outOfStock ? 'secondary' : 'primary'}
      disabled={outOfStock || storeClosed}
      onClick={() => addItem(item)}
      className="h-10 px-2 [&>svg]:hidden min-[360px]:[&>svg]:block"
    >
      {outOfStock ? 'Out of stock' : 'Add to Cart'}
    </Button>
  );
}
