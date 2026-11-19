export function createScrollCamera() {
  let progress = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => progress,
    set(value: number) {
      if (value === progress) return;
      progress = value;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type ScrollCamera = ReturnType<typeof createScrollCamera>;
