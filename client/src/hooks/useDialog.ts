import { useEffect, useRef } from "react";
const stack: symbol[] = [];
const selector =
  'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function useDialog(
  open: boolean,
  onClose: (() => void) | undefined,
  label: string,
) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const id = Symbol();
    stack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const hidden: Array<{ node: HTMLElement; inert: boolean }> = [];
    for (
      let current: HTMLElement | null = element;
      current && current.parentElement;
      current = current.parentElement
    ) {
      for (const sibling of Array.from(current.parentElement.children)) {
        if (sibling !== current && sibling instanceof HTMLElement) {
          hidden.push({ node: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      if (current.parentElement === document.body) break;
    }
    const controls = () =>
      Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(
        (el) =>
          !el.hidden &&
          !el.closest('[hidden],[aria-hidden="true"]') &&
          getComputedStyle(el).display !== "none" &&
          getComputedStyle(el).visibility !== "hidden" &&
          !Array.from(element.querySelectorAll<HTMLElement>("*")).some(
            (parent) =>
              parent !== el &&
              parent.contains(el) &&
              getComputedStyle(parent).display === "none",
          ),
      );
    (controls()[0] || element).focus();
    const keydown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === "Escape" && close.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      }
      if (event.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          element.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === element)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (
        stack[stack.length - 1] === id &&
        !element.contains(event.target as Node)
      )
        (controls()[0] || element).focus();
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      const index = stack.indexOf(id);
      if (index >= 0) stack.splice(index, 1);
      for (const item of hidden) item.node.inert = item.inert;
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return {
    ref,
    role: "dialog" as const,
    "aria-modal": true as const,
    "aria-label": label,
    tabIndex: -1,
  };
}
