import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSimpleOverlayHtml, escapeOverlayText, resolveOverlayInnerHtml } from "./simple.ts";

test("escapeOverlayText escapes HTML special characters", () => {
  assert.equal(
    escapeOverlayText(`Tom & Jerry <3 "quotes"`),
    "Tom &amp; Jerry &lt;3 &quot;quotes&quot;",
  );
});

test("buildSimpleOverlayHtml includes escaped text and vertical position", () => {
  const html = buildSimpleOverlayHtml(`Line <one>`, 42, 0, 32);
  assert.match(html, /top:42%/);
  assert.match(html, /left:0%/);
  assert.match(html, /32px/);
  assert.match(html, /Line &lt;one&gt;/);
});

test("resolveOverlayInnerHtml returns null when disabled or empty", () => {
  assert.equal(
    resolveOverlayInnerHtml({
      enabled: false,
      advanced: false,
      text: "hello",
      verticalAlign: 50,
      horizontalAlign: 0,
      fontSize: 32,
      html: "",
    }),
    null,
  );
  assert.equal(
    resolveOverlayInnerHtml({
      enabled: true,
      advanced: false,
      text: "   ",
      verticalAlign: 50,
      horizontalAlign: 0,
      fontSize: 32,
      html: "",
    }),
    null,
  );
  assert.equal(
    resolveOverlayInnerHtml({
      enabled: true,
      advanced: true,
      text: "",
      verticalAlign: 50,
      horizontalAlign: 0,
      fontSize: 32,
      html: "  ",
    }),
    null,
  );
});

test("resolveOverlayInnerHtml uses simple or advanced markup", () => {
  const simple = resolveOverlayInnerHtml({
    enabled: true,
    advanced: false,
    text: "Caption",
    verticalAlign: 10,
    horizontalAlign: 0,
    fontSize: 32,
    html: "",
  });
  assert.match(simple ?? "", /Caption/);

  const advanced = resolveOverlayInnerHtml({
    enabled: true,
    advanced: true,
    text: "",
    verticalAlign: 10,
    horizontalAlign: 0,
    fontSize: 32,
    html: "<div class='x'>Custom</div>",
  });
  assert.equal(advanced, "<div class='x'>Custom</div>");
});
