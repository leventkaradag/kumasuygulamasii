import { useEffect, type RefObject } from "react";

export function useOutsideClick<T extends HTMLElement>(ref: RefObject<T>, onOutside: () => void) {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onOutside, ref]);
}
