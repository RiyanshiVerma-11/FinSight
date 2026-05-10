import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// ── Strict Recharts Mock ──
vi.mock('recharts', () => {
  const DummyChart = ({ children }) => <svg data-testid="recharts-svg">{children}</svg>;
  return {
    ResponsiveContainer: ({ children }) => <div style={{ width: 800, height: 800 }}>{children}</div>,
    LineChart: DummyChart,
    AreaChart: DummyChart,
    BarChart: DummyChart,
    PieChart: DummyChart,
    Line: () => null,
    Area: () => null,
    Bar: () => null,
    Pie: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Cell: () => null,
  };
});

// ── Framer Motion (Explicit Mocks) ──
vi.mock('framer-motion', () => {
  const motionProps = [
    'animate', 'initial', 'exit', 'variants', 'transition', 
    'whileHover', 'whileTap', 'whileInView', 'viewport', 
    'onAnimationStart', 'onAnimationComplete', 'layout'
  ];
  
  const filterProps = (props) => {
    const newProps = { ...props };
    motionProps.forEach(p => delete newProps[p]);
    return newProps;
  };

  const createMotionComponent = (Tag) => React.forwardRef(({ children, ...props }, ref) => (
    <Tag {...filterProps(props)} ref={ref}>{children}</Tag>
  ));

  const tags = ['div', 'span', 'h1', 'h2', 'h3', 'p', 'tr', 'button', 'a', 'section', 'article', 'ul', 'li'];
  const motion = {};
  tags.forEach(tag => {
    motion[tag] = createMotionComponent(tag);
  });

  return {
    motion,
    AnimatePresence: ({ children }) => children,
    useAnimation: () => ({ start: vi.fn() }),
    useInView: () => [null, true],
  };
});

// ── Lucide React (Explicit Mocks) ──
vi.mock('lucide-react', () => {
  const MockIcon = () => <svg />;
  const icons = [
    'Users', 'ShieldAlert', 'DollarSign', 'TrendingUp', 'TrendingDown', 
    'Target', 'Zap', 'CheckCircle', 'X', 'LayoutDashboard', 'Download', 
    'FileText', 'Briefcase', 'Activity', 'Award', 'AlertTriangle', 
    'Lightbulb', 'Brain', 'Info', 'MessageSquare', 'ShieldCheck',
    'Gift', 'Smartphone', 'Tag', 'Trophy', 'Bell', 'FlaskConical', 
    'RefreshCw', 'Sliders', 'Play', 'ArrowRight', 'CheckCircle2'
  ];
  const mocks = {};
  icons.forEach(icon => {
    mocks[icon] = MockIcon;
  });
  return mocks;
});

globalThis.ResizeObserver = class { observe() { } unobserve() { } disconnect() { } };