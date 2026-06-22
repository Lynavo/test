import { afterEach, describe, expect, it, vi } from 'vitest';
import { installScrollbarActivityTracker } from '../scrollbar-activity';

describe('installScrollbarActivityTracker', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove('vividrop-scrollbar-active');
    document.body.innerHTML = '';
  });

  it('marks the scrolled element active only while scrolling is recent', () => {
    vi.useFakeTimers();
    const scroller = document.createElement('div');
    document.body.append(scroller);

    const cleanup = installScrollbarActivityTracker({ idleMs: 300 });
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(scroller).toHaveClass('vividrop-scrollbar-active');

    vi.advanceTimersByTime(299);
    expect(scroller).toHaveClass('vividrop-scrollbar-active');

    vi.advanceTimersByTime(1);
    expect(scroller).not.toHaveClass('vividrop-scrollbar-active');

    cleanup();
  });

  it('falls back to the document element for page-level scroll events', () => {
    vi.useFakeTimers();
    const cleanup = installScrollbarActivityTracker({ idleMs: 300 });

    document.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(document.documentElement).toHaveClass('vividrop-scrollbar-active');

    cleanup();
    expect(document.documentElement).not.toHaveClass('vividrop-scrollbar-active');
  });
});
