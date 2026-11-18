import { watch, nextTick, onUnmounted, type Ref } from "vue";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside an open dialog: focuses the first control when it
 * opens, traps Tab/Shift+Tab, and restores focus to the trigger when it closes.
 */
export function useModalFocus(
  containerRef: Ref<HTMLElement | null>,
  isOpen: Ref<boolean>,
) {
  let previouslyFocused: HTMLElement | null = null;

  function getFocusable(): HTMLElement[] {
    if (!containerRef.value) return [];
    return Array.from(
      containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
  }

  function focusFirst(): void {
    const elements = getFocusable();
    (elements[0] ?? containerRef.value)?.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Tab") return;
    const elements = getFocusable();
    if (!elements.length) return;
    const first = elements[0]!;
    const last = elements[elements.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  watch(
    isOpen,
    async (open) => {
      if (open) {
        previouslyFocused = document.activeElement as HTMLElement | null;
        await nextTick();
        focusFirst();
      } else {
        previouslyFocused?.focus?.();
        previouslyFocused = null;
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    previouslyFocused?.focus?.();
    previouslyFocused = null;
  });

  return { focusFirst, handleKeydown };
}
