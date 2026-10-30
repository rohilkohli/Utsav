import '@testing-library/jest-dom';
import * as matchers from 'vitest-axe/matchers';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);

// Explicit cleanup after every test — required when singleFork:true shares the jsdom
// document across test files (RTL's own afterEach registration can miss cross-file runs).
afterEach(() => {
  cleanup();
});

// Mock HTMLCanvasElement.getContext for jsdom and axe-core color-contrast checking
// Guard: HTMLCanvasElement is only available in jsdom environments
if (typeof HTMLCanvasElement !== 'undefined') {
HTMLCanvasElement.prototype.getContext = (() => {
  return {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: new Array(4) }),
    putImageData: () => {},
    createImageData: () => ({ data: new Array(4) }),
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  } as unknown as RenderingContext;
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
