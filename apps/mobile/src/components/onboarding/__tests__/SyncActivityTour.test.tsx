import React from 'react';
import { render } from '@testing-library/react-native';
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
});
