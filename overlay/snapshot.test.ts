import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cssContentToText,
  cssValueHasUnsafeUrl,
  isGenericFontFamily,
  parseFontFamilyList,
  resolveCssContentText,
} from "./snapshot.ts";

test("cssContentToText unwraps quoted CSS content", () => {
  assert.equal(cssContentToText('"hello"'), "hello");
  assert.equal(cssContentToText("'x'"), "x");
  assert.equal(cssContentToText("none"), null);
});

test("resolveCssContentText reads counter() from custom properties", () => {
  assert.equal(
    resolveCssContentText("counter(sand)", { varForName: (name) => (name === "sand" ? "42" : "") }),
    "42",
  );
  assert.equal(resolveCssContentText("counter(sand)", { set: "sand 7" }), "7");
});

test("parseFontFamilyList splits quoted families", () => {
  assert.deepEqual(parseFontFamilyList(`"Open Sans", system-ui, sans-serif`), [
    "Open Sans",
    "system-ui",
    "sans-serif",
  ]);
  assert.equal(isGenericFontFamily("sans-serif"), true);
  assert.equal(isGenericFontFamily("Open Sans"), false);
});

test("cssValueHasUnsafeUrl rejects non-data URLs", () => {
  assert.equal(cssValueHasUnsafeUrl("url(https://example.com/a.png)"), true);
  assert.equal(cssValueHasUnsafeUrl("url(data:image/png;base64,xx)"), false);
  assert.equal(cssValueHasUnsafeUrl("#fff"), false);
});
