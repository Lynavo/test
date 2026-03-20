import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';
import { FileIcon, getFileIconConfig } from '../FileIcon';
import { CopyButton } from '../CopyButton';

describe('StatusBadge', () => {
  it('renders "传输中" for transferring status', () => {
    render(<StatusBadge status="transferring" />);
    expect(screen.getByText('传输中')).toBeInTheDocument();
  });

  it('renders "已连接" for connected_idle status', () => {
    render(<StatusBadge status="connected_idle" />);
    expect(screen.getByText('已连接')).toBeInTheDocument();
  });

  it('renders "未连接" for offline status', () => {
    render(<StatusBadge status="offline" />);
    expect(screen.getByText('未连接')).toBeInTheDocument();
  });
});

describe('FileIcon', () => {
  it('maps .mp4 to FileVideo (blue) config', () => {
    const config = getFileIconConfig('clip.mp4');
    expect(config.color).toBe('#3b82f6');
  });

  it('renders without crashing', () => {
    const { container } = render(<FileIcon name="video.mp4" />);
    expect(container.querySelector('div')).toBeInTheDocument();
  });
});

describe('CopyButton', () => {
  it('renders with label', () => {
    render(<CopyButton text="hello" label="Copy IP" />);
    expect(screen.getByText('Copy IP')).toBeInTheDocument();
  });

  it('renders without label', () => {
    const { container } = render(<CopyButton text="some-text" />);
    expect(container.querySelector('button')).toBeInTheDocument();
  });
});
