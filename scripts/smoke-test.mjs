import assert from "node:assert/strict";
import { safeUploadParts } from "../src/server/storage";
import { optimizeSequence } from "../src/server/routing/optimize";
import { paginationFromUrl } from "../src/server/lib/validate";

function testSafeUpload() {
  assert.deepEqual(safeUploadParts(["org1", "photo_abc.jpg"], "org1"), [
    "org1",
    "photo_abc.jpg",
  ]);
  assert.equal(safeUploadParts(["org1", "..", "etc"], "org1"), null);
  assert.equal(safeUploadParts(["other", "x.jpg"], "org1"), null);
  assert.equal(safeUploadParts(["org1", "a/b.jpg"], "org1"), null);
}

function testOptimize() {
  const ids = optimizeSequence([
    { id: "a", lat: -23.55, lng: -46.63 },
    { id: "b", lat: -23.56, lng: -46.64 },
    { id: "c", lat: -23.54, lng: -46.62 },
  ]);
  assert.equal(ids.length, 3);
  assert.ok(ids.includes("a") && ids.includes("b") && ids.includes("c"));
}

function testPagination() {
  const u = new URL("http://x/api?page=2&limit=50");
  const p = paginationFromUrl(u);
  assert.equal(p.page, 2);
  assert.equal(p.limit, 50);
  assert.equal(p.offset, 50);
}

testSafeUpload();
testOptimize();
testPagination();
console.log("ok — smoke tests passed");
