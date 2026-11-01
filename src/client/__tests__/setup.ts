import '@testing-library/jest-dom/vitest';
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
      fillRect: () => undefined,
      clearRect: () => undefined,
      getImageData: () => ({ data: Array.from({ length: 4 }, () => 0) }),
      putImageData: () => undefined,
      createImageData: () => ({ data: Array.from({ length: 4 }, () => 0) }),
      setTransform: () => undefined,
      drawImage: () => undefined,
      save: () => undefined,
      fillText: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      stroke: () => undefined,
      translate: () => undefined,
      scale: () => undefined,
      rotate: () => undefined,
      arc: () => undefined,
      fill: () => undefined,
      measureText: () => ({ width: 0 }),
      transform: () => undefined,
      rect: () => undefined,
      clip: () => undefined,
    } as unknown as RenderingContext;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

// jsdom does not implement pseudo-element styling; real browser axe audits cover it.
if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (element) => originalGetComputedStyle(element);
}
