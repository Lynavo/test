import React from 'react';
import { render } from '@testing-library/react-native';
import { Modal, Platform, StatusBar } from 'react-native';
import { Path } from 'react-native-svg';

import { SyncActivityTour } from '../SyncActivityTour';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'syncActivity.onboarding.next'
        ? `next ${values?.step}/${values?.total}`
        : key,
  }),
}));

jest.mock('../../Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const ReactInner = require('react');
    const { Text } = require('react-native');
    return ReactInner.createElement(Text, null, name);
  },
}));

describe('SyncActivityTour', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    Object.defineProperty(StatusBar, 'currentHeight', {
      configurable: true,
      value: undefined,
    });
  });

  it('renders the dim overlay as an even-odd path with the active target cut out', () => {
    const screen = render(
      <SyncActivityTour
        visible
        onSkip={jest.fn()}
        onFinish={jest.fn()}
        targetLayouts={{
          album: { left: 40, top: 420, width: 140, height: 90 },
        }}
      />,
    );

    const overlayPath = screen
      .UNSAFE_getAllByType(Path)
      .find(node => node.props.testID === 'sync-activity-tour-cutout-overlay');

    expect(overlayPath).toBeTruthy();
    expect(overlayPath?.props.fillRule).toBe('evenodd');
    expect(overlayPath?.props.d).toContain('M0 0');
    expect(overlayPath?.props.d).toContain('Q28 408');
    expect(overlayPath?.props.d).toContain('Q192 408');
    expect(overlayPath?.props.d).toContain('Q192 522');
  });

  it('allows the modal to draw under Android system navigation bars', () => {
    const screen = render(
      <SyncActivityTour visible onSkip={jest.fn()} onFinish={jest.fn()} />,
    );

    const getByType = screen.UNSAFE_getByType as (type: unknown) => {
      props: Record<string, unknown>;
    };
    const modal = getByType(Modal);

    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
  });

  it('aligns measured Android targets to the translucent modal coordinate space', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(StatusBar, 'currentHeight', {
      configurable: true,
      value: 24,
    });

    const screen = render(
      <SyncActivityTour
        visible
        onSkip={jest.fn()}
        onFinish={jest.fn()}
        targetLayouts={{
          album: { left: 40, top: 420, width: 140, height: 90 },
        }}
      />,
    );

    const overlayPath = screen
      .UNSAFE_getAllByType(Path)
      .find(node => node.props.testID === 'sync-activity-tour-cutout-overlay');

    expect(overlayPath?.props.d).toContain('Q28 432');
    expect(overlayPath?.props.d).toContain('Q192 432');
    expect(overlayPath?.props.d).toContain('Q192 546');
  });
});
