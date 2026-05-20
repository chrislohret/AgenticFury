import { describe, it, expect } from 'vitest';
import { render, screen } from '../tests/setup/test-utils';
import { App } from './App';

describe('App — smoke tests', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('displays the app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('shows the celebratory launch screen', () => {
    render(<App />);
    // The launch screen always contains the golden-path loop text
    expect(screen.getByText(/is live!/i)).toBeTruthy();
  });
});
