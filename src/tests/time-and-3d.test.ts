/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../index';
import type { CompileSuccess } from '../index';
import { decompile } from '../compiler/decompile';

function ok(src: string): CompileSuccess {
  const r = compile(src);
  assert.ok(r.success, `expected a compile, got: ${r.success ? '' : JSON.stringify(r.errors)}`);
  return r;
}

function latexOf(src: string, id: string): string {
  const expr = ok(src).state.expressions.list.find(e => e.id === id);
  assert.ok(expr, `no expression with id ${id}`);
  return expr.latex ?? '';
}

describe('the clock', () => {
  test('is a slider that plays', () => {
    const T = ok('time T = time(0..1)').state.expressions.list[0];
    assert.equal(T.latex, 'T=0');
    assert.equal(T.slider?.isPlaying, true);
    assert.equal(T.slider?.loopMode, 'LOOP_FORWARD');
  });

  test('sweeps 0 to 1 over four seconds unless told otherwise', () => {
    const clock = ok('time T = time(0..1)').clock;
    assert.deepEqual(clock, { id: 'T', name: 'T', min: 0, max: 1, period: 4000, mode: 'loop' });
  });

  test('takes a range and a period', () => {
    const clock = ok('time T = time(0..6.28, period=6000)').clock;
    assert.equal(clock?.min, 0);
    assert.equal(clock?.max, 6.28);
    assert.equal(clock?.period, 6000);
  });

  test('the bounds are hard, so the value cannot leave the range', () => {
    const T = ok('time T = time(2..5)').state.expressions.list[0];
    assert.equal(T.slider?.min, '2');
    assert.equal(T.slider?.max, '5');
    assert.equal(T.slider?.hardMin, true);
    assert.equal(T.slider?.hardMax, true);
    // it starts at the bottom of its range, not at zero
    assert.equal(T.latex, 'T=2');
  });

  test('mirror turns around at the end instead of jumping back', () => {
    const T = ok('time T = time(0..1, mode=mirror)').state.expressions.list[0];
    assert.equal(T.slider?.loopMode, 'LOOP_FORWARD_REVERSE');
    assert.equal(ok('time T = time(0..1, mode=mirror)').clock?.mode, 'mirror');
  });

  test('source with no clock reports none', () => {
    assert.equal(ok('a = 1').clock, null);
  });

  test('the clock is a name other statements can use', () => {
    assert.match(latexOf('time T = time(0..1)\nb = 2T', 'b'), /T/);
  });

  test('a second clock is a compile error', () => {
    const r = compile('time T = time(0..1)\ntime U = time(0..1)');
    assert.ok(!r.success);
    assert.match(r.errors[0].message, /[Oo]nly one 'time'/);
  });

  test('a graph edit never rewrites a playing slider, which would stop it', () => {
    const T = ok('time T = time(0..5, period=2000)').state.expressions.list[0];
    assert.equal(decompile(T, 'T'), null);
  });

  test('an ordinary slider still decompiles', () => {
    const a = ok('a = slider(1, 0, 10)').state.expressions.list[0];
    assert.equal(decompile(a, 'a'), 'a = slider(1, 0, 10)');
  });
});

describe('the camera and project()', () => {
  test('the angles go out as their own variables', () => {
    const list = ok('camera cam = camera(azimuth=0.6, elevation=0.4)').state.expressions.list;
    assert.deepEqual(list.map(e => e.latex), ['c_{az}=0.6', 'c_{el}=0.4']);
  });

  test('project reads the declared camera, so animating it turns the scene', () => {
    const latex = latexOf('time T = time(0..1)\ncamera cam = camera(azimuth=T, elevation=0.4)\np = project(1, 2, 3)', 'p');
    assert.ok(latex.includes('c_{az}'), latex);
    assert.ok(latex.includes('c_{el}'), latex);
  });

  test('a camera below the project line is still found', () => {
    const latex = latexOf('p = project(1, 2, 3)\ncamera cam = camera(azimuth=0.6, elevation=0.4)', 'p');
    assert.ok(latex.includes('c_{az}'), latex);
  });

  test('with no camera it falls back to fixed angles', () => {
    const latex = latexOf('p = project(1, 2, 3)', 'p');
    assert.ok(!latex.includes('c_{az}'), latex);
    assert.ok(latex.includes('0.6') && latex.includes('0.4'), latex);
  });

  test('the result is a point', () => {
    const latex = latexOf('p = project(1, 2, 3)', 'p');
    assert.match(latex, /^p=\\left\(.*,.*\\right\)$/);
  });

  test('z defaults to zero, so a 2d point still projects', () => {
    const two   = latexOf('p = project(1, 2)', 'p');
    const three = latexOf('p = project(1, 2, 0)', 'p');
    // the only difference is how the zero is spelled
    assert.equal(two.replace(/\\left\(0\\right\)/g, '0'), three.replace(/\\left\(0\\right\)/g, '0'));
  });

  test('a height must be declared, since desmos 2d has no z of its own', () => {
    const r = compile('p = project(x, y, z)');
    assert.ok(!r.success);
    assert.match(r.errors[0].message, /undefined variable 'z'/);
  });

  test('a second camera is a compile error', () => {
    const r = compile('camera a = camera(azimuth=0, elevation=0)\ncamera b = camera(azimuth=1, elevation=1)');
    assert.ok(!r.success);
    assert.match(r.errors[0].message, /[Oo]nly one 'camera'/);
  });

  test('the projection is the standard one: no turn and no tilt shows the y-z plane', () => {
    const latex = latexOf('h = 1\ncamera c = camera(azimuth=0, elevation=0)\np = project(x, y, h)', 'p');
    assert.ok(latex.includes('\\sin\\left(c_{az}\\right)'), latex);
    assert.ok(latex.includes('\\cos\\left(c_{el}\\right)'), latex);
  });
});

describe('the animation presets', () => {
  test('ease is a smoothstep', () => {
    assert.equal(latexOf('p = ease(0.5)', 'p'), 'p=\\left(0.5\\right)^{2}\\left(3-2\\left(0.5\\right)\\right)');
  });

  test('pulse rises and falls across the sweep', () => {
    assert.equal(latexOf('p = pulse(0.25)', 'p'), 'p=1-\\left|2\\left(0.25\\right)-1\\right|');
  });

  test('bounce never goes below zero', () => {
    assert.match(latexOf('p = bounce(0.25)', 'p'), /\\left\|\\sin/);
  });

  test('wobble takes an amplitude, and defaults it to one', () => {
    assert.match(latexOf('p = wobble(0.25)', 'p'), /^p=1\\sin/);
    assert.match(latexOf('p = wobble(0.25, 3)', 'p'), /^p=\\left\(3\\right\)\\sin/);
  });

  test('orbit is a point going round a circle', () => {
    const latex = latexOf('p = orbit(0.5, 2)', 'p');
    assert.match(latex, /^p=\\left\(.*\\cos.*,.*\\sin.*\\right\)$/);
  });

  test('a preset reads the clock', () => {
    assert.match(latexOf('time T = time(0..1)\np = ease(T)', 'p'), /T/);
  });

  test('a preset is not treated as an undeclared name', () => {
    assert.ok(compile('p = ease(0.5)').success);
  });
});
