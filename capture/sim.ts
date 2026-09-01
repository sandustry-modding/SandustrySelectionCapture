import { getSession } from "../game/session";

/**
 * WorkerMessage.SetPaused in the current game bundle (`dist/js/bundle.js`).
 * Pause must also reach the simulation worker — `session.paused` alone is not enough.
 */
const WORKER_SET_PAUSED = 54;

type EnvironmentShape = {
  multithreading?: {
    simulation?: {
      manager?: { postMessage: (data: unknown) => void };
    };
  };
};

export function setSimulationPaused(paused: boolean): void {
  const session = getSession();
  if (session) session.paused = paused;

  const environment = sandkit.state.environment as EnvironmentShape;
  const manager = environment.multithreading?.simulation?.manager;
  if (!manager?.postMessage) return;
  try {
    manager.postMessage([WORKER_SET_PAUSED, paused]);
  } catch (error) {
    console.warn(`SetPaused worker message failed:`, error);
  }
}

export function waitTicks(
  api: SandkitApi,
  count: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    let left = count;
    const timeoutId = setTimeout(() => {
      setSimulationPaused(true);
      reject(new Error("tick wait timed out"));
    }, 15_000);

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    const step = () => {
      if (signal?.aborted) return;
      left -= 1;
      if (left <= 0) {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
        setSimulationPaused(true);
        resolve();
        return;
      }
      api.schedule.nextTick(step);
    };

    api.schedule.nextTick(step);
    setSimulationPaused(false);
  });
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
