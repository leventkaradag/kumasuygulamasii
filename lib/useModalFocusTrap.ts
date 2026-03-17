"use client";

import { useEffect, useRef, type RefObject } from "react";

const modalStack: symbol[] = [];

export const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) return [] as HTMLElement[];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
};

type UseModalFocusTrapOptions = {
  enabled?: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
};

export const useModalFocusTrap = ({
  enabled = true,
  containerRef,
  initialFocusRef,
  restoreFocus = true,
}: UseModalFocusTrapOptions) => {
  const modalIdRef = useRef(Symbol("modal-focus-trap"));
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const modalId = modalIdRef.current;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalStack.push(modalId);

    const focusInside = () => {
      const container = containerRef.current;
      if (!container) return;

      const preferredTarget = initialFocusRef?.current;
      if (preferredTarget && container.contains(preferredTarget)) {
        preferredTarget.focus();
        return;
      }

      const focusables = getFocusableElements(container);
      (focusables[0] ?? container).focus();
    };

    const frameId = window.requestAnimationFrame(focusInside);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== modalId) return;
      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeInside = activeElement ? container.contains(activeElement) : false;

      if (event.shiftKey) {
        if (!activeInside || activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!activeInside || activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (modalStack[modalStack.length - 1] !== modalId) return;

      const container = containerRef.current;
      if (!container) return;

      const target = event.target;
      if (target instanceof HTMLElement && container.contains(target)) return;

      focusInside();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);

      const stackIndex = modalStack.lastIndexOf(modalId);
      if (stackIndex >= 0) {
        modalStack.splice(stackIndex, 1);
      }

      if (restoreFocus && previousFocusRef.current && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [enabled, containerRef, initialFocusRef, restoreFocus]);
};
