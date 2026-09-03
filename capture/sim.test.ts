import assert from "node:assert/strict";
import test from "node:test";
import { isAbortError, throwIfAborted, waitTick } from "./sim.ts";

function mockApi(fireTick: (cb: () => void) => void): SandkitApi {
  return {
    schedule: {
      nextTick: (cb: () => void) => {
        fireTick(cb);
      },
    },
  } as unknown as SandkitApi;
}

test("waitTick resolves on abort instead of rejecting", async () => {
  const abort = new AbortController();
  let tickCb: (() => void) | undefined;
  const pending = waitTick(
    mockApi((cb) => {
      tickCb = cb;
    }),
    abort.signal,
  );
  abort.abort();
  await pending;
  assert.equal(abort.signal.aborted, true);
  assert.equal(tickCb !== undefined, true);
  // Late tick must not throw
  tickCb?.();
});

test("waitTick resolves when already aborted", async () => {
  const abort = new AbortController();
  abort.abort();
  await waitTick(
    mockApi(() => {
      assert.fail("nextTick should not be required when already aborted");
    }),
    abort.signal,
  );
});

test("throwIfAborted and isAbortError", () => {
  const abort = new AbortController();
  abort.abort();
  try {
    throwIfAborted(abort.signal);
    assert.fail("expected throw");
  } catch (error) {
    assert.equal(isAbortError(error), true);
  }
});
