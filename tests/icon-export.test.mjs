import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OUTPUT_PRESETS, MAX_OUTPUT_BYTES, inputError, outputFilename, drawExport, encodePng } from '../src/icon-export.ts';

function context() {
  const calls = [];
  const ctx = {};
  for (const method of ['clearRect', 'save', 'beginPath', 'arc', 'clip', 'fillRect', 'drawImage', 'restore']) {
    ctx[method] = (...args) => calls.push([method, ...args]);
  }
  return { ctx, calls };
}

test('presets and filenames are 500px _s and 200px _ss', () => {
  assert.equal(OUTPUT_PRESETS.libecity.size, 500);
  assert.equal(OUTPUT_PRESETS.ovice.size, 200);
  assert.equal(outputFilename('libecity'), 'profile_icon_s.png');
  assert.equal(outputFilename('ovice'), 'profile_icon_ss.png');
});
test('both output sizes keep exactly the same framing', () => {
  const image = { width: 1920, height: 1080 };
  const draws = [500, 200].map(size => {
    const { ctx, calls } = context();
    drawExport(ctx, image, { x: -25, y: 43 }, 0.4, size, 'square');
    const draw = calls.find(c => c[0] === 'drawImage');
    assert.deepEqual(calls.find(c => c[0] === 'fillRect'), ['fillRect', 0, 0, size, size]);
    assert.equal(ctx.fillStyle, '#ffffff');
    assert.equal(ctx.imageSmoothingQuality, 'high');
    return draw.slice(2).map(v => v / size);
  });
  draws[0].forEach((value, index) => assert.ok(Math.abs(value - draws[1][index]) < 1e-12));
});
test('round mode clips, preserves transparent background, and restores context', () => {
  const { ctx, calls } = context();
  drawExport(ctx, { width: 800, height: 600 }, { x: 0, y: 0 }, 0.5, 200, 'round');
  assert.deepEqual(calls.find(c => c[0] === 'arc'), ['arc', 100, 100, 100, 0, Math.PI * 2]);
  assert.ok(calls.some(c => c[0] === 'clip'));
  assert.ok(!calls.some(c => c[0] === 'fillRect'));
  assert.equal(calls.at(-1)[0], 'restore');
  assert.ok(!calls.some(c => ['stroke', 'setLineDash'].includes(c[0])));
});
test('supported inputs use a separately documented 20 MB tool limit', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(inputError({ type, size: 20_000_000 }), null);
  }
  assert.match(inputError({ type: 'image/png', size: 20_000_001 }), /20 MB/);
  for (const type of ['text/plain', 'image/svg+xml', 'image/gif', 'image/heic', '']) {
    assert.match(inputError({ type, size: 1 }), /JPG/);
  }
});
test('PNG is encoded and actual blob capacity is checked at 2 MB boundary', async () => {
  const expected = new Blob([new Uint8Array(MAX_OUTPUT_BYTES)], { type: 'image/png' });
  const canvas = { toBlob(callback, type) { assert.equal(type, 'image/png'); callback(expected); } };
  assert.equal(await encodePng(canvas), expected);
  await assert.rejects(encodePng({ toBlob: cb => cb(new Blob([new Uint8Array(MAX_OUTPUT_BYTES + 1)], { type: 'image/png' })) }), /2 MB/);
});
test('empty, failed, wrong-format, and throwing canvas encoders fail safely', async () => {
  for (const blob of [null, new Blob([], { type: 'image/png' }), new Blob(['x'], { type: 'image/jpeg' })]) {
    await assert.rejects(encodePng({ toBlob: cb => cb(blob) }), /PNG/);
  }
  await assert.rejects(encodePng({ toBlob() { throw new Error('SecurityError'); } }), /SecurityError/);
});
