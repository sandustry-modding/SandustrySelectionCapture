import gifWorkerSource from "./gifWorker.ts?worker-text";
import type { EncodedGif } from "./gifLimit";

export type { EncodedGif };

type WorkerFrameReply = {
  type: "frame";
  accepted: boolean;
  frameCount: number;
  byteLength: number;
};

type WorkerDoneReply = {
  type: "done";
  bytes: ArrayBuffer;
  frameCount: number;
  hitLimit: boolean;
  width: number;
  height: number;
};

type WorkerReply =
  | { type: "started" }
  | WorkerFrameReply
  | WorkerDoneReply
  | { type: "too-large" }
  | { type: "error"; message: string };

let gifWorkerBlobUrl: string | undefined;

function gifEncodeWorkerUrl(): string {
  if (gifWorkerBlobUrl) return gifWorkerBlobUrl;
  gifWorkerBlobUrl = URL.createObjectURL(new Blob([gifWorkerSource], { type: "text/javascript" }));
  return gifWorkerBlobUrl;
}

function waitForReply(worker: Worker, expected: WorkerReply["type"]): Promise<WorkerReply> {
  return new Promise((resolve, reject) => {
    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || "GIF worker error"));
    };
    const onMessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === "error") {
        cleanup();
        reject(new Error(reply.message));
        return;
      }
      if (reply.type !== expected && reply.type !== "too-large") return;
      cleanup();
      resolve(reply);
    };
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
  });
}

export type GifEncodeSession = {
  addFrame(rgba: Uint8ClampedArray, signal?: AbortSignal): Promise<WorkerFrameReply>;
  finish(signal?: AbortSignal): Promise<EncodedGif | "too-large">;
  close(): void;
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

/** Open a persistent gifenc worker. Close it when the GIF is done or cancelled. */
export async function openGifEncodeSession(options: {
  width: number;
  height: number;
  delay: number;
  maxBytes: number;
  optimize?: boolean;
  signal?: AbortSignal;
}): Promise<GifEncodeSession> {
  throwIfAborted(options.signal);
  const worker = new Worker(gifEncodeWorkerUrl());
  const started = waitForReply(worker, "started");
  worker.postMessage({
    type: "start",
    width: options.width,
    height: options.height,
    delay: options.delay,
    maxBytes: options.maxBytes,
    optimize: options.optimize === true,
  });
  const reply = await started;
  if (reply.type !== "started") {
    worker.terminate();
    throw new Error("GIF worker failed to start");
  }

  let closed = false;
  let chain: Promise<void> = Promise.resolve();
  const close = () => {
    if (closed) return;
    closed = true;
    worker.terminate();
  };

  options.signal?.addEventListener(
    "abort",
    () => {
      close();
    },
    { once: true },
  );

  return {
    async addFrame(rgba, signal) {
      throwIfAborted(signal);
      if (closed) throw new DOMException("Aborted", "AbortError");
      const copy = new Uint8Array(rgba.byteLength);
      copy.set(rgba);
      const run = chain.then(async () => {
        throwIfAborted(signal);
        if (closed) throw new DOMException("Aborted", "AbortError");
        const pending = waitForReply(worker, "frame");
        worker.postMessage({ type: "frame", rgba: copy.buffer }, [copy.buffer]);
        const frameReply = await pending;
        if (frameReply.type !== "frame") {
          throw new Error("GIF worker frame reply missing");
        }
        return frameReply;
      });
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    async finish(signal) {
      throwIfAborted(signal);
      if (closed) throw new DOMException("Aborted", "AbortError");
      await chain;
      throwIfAborted(signal);
      if (closed) throw new DOMException("Aborted", "AbortError");
      const pending = waitForReply(worker, "done");
      worker.postMessage({ type: "finish" });
      const done = await pending;
      close();
      if (done.type === "too-large") return "too-large";
      if (done.type !== "done") throw new Error("GIF worker finish reply missing");
      return {
        bytes: new Uint8Array(done.bytes),
        frameCount: done.frameCount,
        hitLimit: done.hitLimit,
        width: done.width,
        height: done.height,
      };
    },
    close,
  };
}
