import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { useModalFocus } from "../../app/composables/useModalFocus";

interface FakeElement {
  focus: ReturnType<typeof vi.fn>;
}

function makeElements(count: number): FakeElement[] {
  return Array.from({ length: count }, () => ({ focus: vi.fn() }));
}

function makeContainer(elements: FakeElement[]): HTMLElement {
  return {
    querySelectorAll: vi.fn(() => elements),
    focus: vi.fn(),
  } as unknown as HTMLElement;
}

function setActiveElement(value: unknown): void {
  Object.defineProperty(document, "activeElement", {
    value,
    writable: true,
    configurable: true,
  });
}

function makeKeyEvent(key: string, shiftKey = false): KeyboardEvent {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe("useModalFocus", () => {
  beforeEach(() => {
    setActiveElement(null);
  });

  it("focuses first focusable element when opened", async () => {
    const elements = makeElements(2);
    const containerRef = ref<HTMLElement | null>(makeContainer(elements));
    useModalFocus(containerRef, ref(true));

    await nextTick();
    expect(elements[0]!.focus).toHaveBeenCalledTimes(1);
    expect(elements[1]!.focus).not.toHaveBeenCalled();
  });

  it("does not steal focus when closed", async () => {
    const elements = makeElements(2);
    const containerRef = ref<HTMLElement | null>(makeContainer(elements));
    useModalFocus(containerRef, ref(false));

    await nextTick();
    expect(elements[0]!.focus).not.toHaveBeenCalled();
  });

  it("restores focus to previously focused element on close", async () => {
    const trigger: FakeElement = { focus: vi.fn() };
    setActiveElement(trigger);

    const elements = makeElements(1);
    const containerRef = ref<HTMLElement | null>(makeContainer(elements));
    const isOpen = ref(true);
    useModalFocus(containerRef, isOpen);

    await nextTick();
    expect(elements[0]!.focus).toHaveBeenCalledTimes(1);

    isOpen.value = false;
    await nextTick();
    expect(trigger.focus).toHaveBeenCalledTimes(1);
  });

  it("traps Tab from the last element back to the first", async () => {
    const elements = makeElements(2);
    const containerRef = ref<HTMLElement | null>(makeContainer(elements));
    const { handleKeydown } = useModalFocus(containerRef, ref(true));
    await nextTick();

    setActiveElement(elements[1]);
    const event = makeKeyEvent("Tab");
    handleKeydown(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(elements[0]!.focus).toHaveBeenCalled();
  });

  it("traps Shift+Tab from the first element back to the last", async () => {
    const elements = makeElements(2);
    const containerRef = ref<HTMLElement | null>(makeContainer(elements));
    const { handleKeydown } = useModalFocus(containerRef, ref(true));
    await nextTick();

    setActiveElement(elements[0]);
    const event = makeKeyEvent("Tab", true);
    handleKeydown(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(elements[1]!.focus).toHaveBeenCalledTimes(1);
  });

  it("allows Tab from middle elements without trapping", async () => {
    const elements = makeElements(3);
    const containerRef = ref<HTMLElement | null>(makeContainer(elements));
    const { handleKeydown } = useModalFocus(containerRef, ref(true));
    await nextTick();

    setActiveElement(elements[1]);
    const event = makeKeyEvent("Tab");
    handleKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores non-Tab keys", async () => {
    const elements = makeElements(2);
    const containerRef = ref<HTMLElement | null>(makeContainer(elements));
    const { handleKeydown } = useModalFocus(containerRef, ref(true));
    await nextTick();

    setActiveElement(elements[1]);
    const event = makeKeyEvent("Enter");
    handleKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("focuses the container when nothing is focusable", async () => {
    const container = makeContainer([]);
    (container as unknown as { focus: ReturnType<typeof vi.fn> }).focus = vi.fn();
    const containerRef = ref<HTMLElement | null>(container);
    const { focusFirst } = useModalFocus(containerRef, ref(false));
    focusFirst();
    expect((container as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalledTimes(1);
  });
});