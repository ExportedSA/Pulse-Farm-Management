type Container = Pick<ServiceWorkerContainer, "controller" | "addEventListener" | "removeEventListener">;

/**
 * Calls onUpdate once when a new version of Pulse takes over this page (its service worker changes),
 * so the person can reload when it suits them. It never reloads by itself, which could lose unsaved
 * work, and it stays quiet when a worker takes over a page that had none: that's a first visit, not
 * an update. Returns a function that stops watching.
 */
export function watchForUpdates(container: Container, onUpdate: () => void): () => void {
  let hadController = !!container.controller;
  let told = false;
  const changed = () => {
    if (hadController && !told) {
      told = true;
      onUpdate();
    }
    hadController = true;
  };
  container.addEventListener("controllerchange", changed);
  return () => container.removeEventListener("controllerchange", changed);
}
