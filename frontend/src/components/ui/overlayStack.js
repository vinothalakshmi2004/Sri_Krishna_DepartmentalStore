/**
 * Tracks open modals/drawers so the Escape key only closes the top-most one
 * (e.g. a confirm dialog opened on top of the order drawer).
 */
const stack = [];

export const pushOverlay = (id) => {
  stack.push(id);
};

export const removeOverlay = (id) => {
  const index = stack.lastIndexOf(id);
  if (index !== -1) stack.splice(index, 1);
};

export const isTopOverlay = (id) => stack[stack.length - 1] === id;
