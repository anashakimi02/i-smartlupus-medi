import { render, screen } from '@testing-library/react';
import StatusChart from './StatusChart';
import { describe, it, expect, vi } from 'vitest';

// Mock Recharts because it uses SVG dimensions
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div>Bar</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  Tooltip: () => <div>Tooltip</div>,
  Cell: () => <div>Cell</div>,
}));

describe('StatusChart', () => {
  it('should render correctly with provided data', () => {
    const mockData = [
      { name: 'Menunggu', value: 10, color: '#2563eb' },
      { name: 'Proses', value: 5, color: '#f97316' },
    ];
    render(<StatusChart data={mockData} />);
    expect(screen.getByText('Taburan Status Semasa')).toBeInTheDocument();
  });
});
