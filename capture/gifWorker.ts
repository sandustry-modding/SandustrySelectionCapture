import { createGifStream, type GifStream } from "./encodeCore";

type StartMessage = {
  type: "start";
  width: number;
  height: number;
  delay: number;
  maxBytes: number;
};

type FrameMessage = {
  type: "frame";
  rgba: ArrayBuffer;
};

type FinishMessage = { type: "finish" };

type WorkerIn = StartMessage | FrameMessage | FinishMessage;

let stream: GifStream | null = null;

function reply(data: unknown, transfer?: Transferable[]): void {
  if (transfer && transfer.length > 0) {
    self.postMessage(data, transfer);
    return;
  }
  self.postMessage(data);
}

self.onmessage = (event: MessageEvent<WorkerIn>) => {
  const msg = event.data;
  try {
    if (msg.type === "start") {
      stream = createGifStream({
        width: msg.width,
        height: msg.height,
        delay: msg.delay,
        maxBytes: msg.maxBytes,
      });
      reply({ type: "started" });
      return;
    }

    if (msg.type === "frame") {
      if (!stream) {
        reply({ type: "error", message: "GIF worker has no stream" });
        return;
      }
      const rgba = new Uint8ClampedArray(msg.rgba);
      const result = stream.addFrame(rgba);
      reply({ type: "frame", ...result });
      return;
    }

    if (msg.type === "finish") {
      if (!stream) {
        reply({ type: "error", message: "GIF worker has no stream" });
        return;
      }
      const encoded = stream.finish();
      stream = null;
      if (encoded === "too-large") {
        reply({ type: "too-large" });
        return;
      }
      const copy = new Uint8Array(encoded.bytes);
      reply(
        {
          type: "done",
          bytes: copy.buffer,
          frameCount: encoded.frameCount,
          hitLimit: encoded.hitLimit,
          width: encoded.width,
          height: encoded.height,
        },
        [copy.buffer],
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reply({ type: "error", message });
  }
};
