/**
 * tests/setup.js — Global test setup for Vitest + React Testing Library.
 *
 * - Imports jest-dom matchers (toBeInTheDocument, toHaveClass, etc.)
 * - Mocks framer-motion to avoid animation side-effects
 * - Mocks axios globally so no real HTTP requests are made
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ── framer-motion stub ─────────────────────────────────────────────────────
// Renders children directly without animation wrappers, keeps snapshots clean.
vi.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy({}, {
    get: (_, tag) => {
      const Tag = typeof tag === 'string' ? tag : 'div';
      return React.forwardRef(({ children, ...props }, ref) => {
        // Strip framer-motion-specific props
        const clean = Object.fromEntries(
          Object.entries(props).filter(([k]) =>
            !['initial', 'animate', 'exit', 'transition', 'whileHover',
              'whileTap', 'variants', 'layout'].includes(k)
          )
        );
        return React.createElement(Tag, { ...clean, ref }, children);
      });
    }
  });

  return {
    motion,
    AnimatePresence: ({ children }) => children,
    useAnimation: () => ({ start: vi.fn() }),
    useInView: () => [null, true],
  };
});

// ── axios stub ─────────────────────────────────────────────────────────────
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    create: vi.fn(() => ({ get: vi.fn(), post: vi.fn() })),
  },
}));

// ── lucide-react stub ──────────────────────────────────────────────────────
// Render as simple <svg> to avoid missing icon errors in tests.
vi.mock('lucide-react', () => {
  const React = require('react');
  const handler = {
    get: (_, name) => (props) => React.createElement('svg', { 'data-icon': name, ...props }),
  };
  return new Proxy({}, handler);
});

// ── react-joyride stub ─────────────────────────────────────────────────────
vi.mock('react-joyride', () => ({
  default: () => null,
  STATUS: { FINISHED: 'finished', SKIPPED: 'skipped' },
}));

// ── html2canvas + jspdf stubs ──────────────────────────────────────────────
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => 'data:image/png;base64,stub',
    height: 100,
    width: 200,
  }),
}));

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210 } },
    addImage: vi.fn(),
    save: vi.fn(),
  })),
}));

// ── window.URL.createObjectURL stub ───────────────────────────────────────
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
globalThis.URL.revokeObjectURL = vi.fn();

// ── Recharts stub ─────────────────────────────────────────────────────────
// ResponsiveContainer often hangs in jsdom because it waits for parent dimensions.
vi.mock('recharts', async () => {
  const OriginalModule = await vi.importActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }) => (
      <div className="recharts-responsive-container" style={{ width: '800px', height: '800px' }}>
        {children}
      </div>
    ),
  };
});

// ── ResizeObserver stub ───────────────────────────────────────────────────
// Required for components that perform layout measurements (like Recharts).
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
