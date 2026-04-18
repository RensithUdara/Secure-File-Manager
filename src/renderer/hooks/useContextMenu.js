import { useCallback, useState } from 'react';

export default function useContextMenu() {
  const [menu, setMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    entry: null,
  });

  const openMenu = useCallback((event, entry) => {
    event.preventDefault();
    setMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      entry,
    });
  }, []);

  const closeMenu = useCallback(() => {
    setMenu((prev) => ({ ...prev, open: false, entry: null }));
  }, []);

  return { menu, openMenu, closeMenu };
}
