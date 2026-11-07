import React from 'react';

interface MockDataBannerProps {
  isDbConnected?: boolean;
}

// Banner removed — no longer displayed in the UI
export const MockDataBanner: React.FC<MockDataBannerProps> = (_props) => {
  return null;
};
