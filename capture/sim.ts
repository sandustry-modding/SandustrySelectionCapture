import { getSession } from "../game/session.ts";

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

/**
 * Wait for the next sim tick. Abort resolves (does not reject) so a tick wait
 * started in parallel with encode cannot throw an uncaught AbortError.
 * Callers must use `throwIfAborted` after await when cancel should stop the flow.
 */
export function waitTick(
  api: SandkitApi,
  signal: AbortSignal | undefined,
  options?: { step?: boolean },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const step = options?.step === true;
    const timeoutId = setTimeout(() => {
      cleanup();
      if (step) setSimulationPaused(true);
      reject(new Error("tick wait timed out"));
    }, 15_000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      if (step) setSimulationPaused(true);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    if (step) setSimulationPaused(false);
    api.schedule.nextTick(() => {
      if (signal?.aborted) {
        cleanup();
        if (step) setSimulationPaused(true);
        resolve();
        return;
      }
      cleanup();
      if (step) setSimulationPaused(true);
      resolve();
    });
  });
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) && error.name === "AbortError"
  );
}
