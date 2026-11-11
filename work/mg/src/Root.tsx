import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
export const Root: React.FC = () => (
  <Composition id="Main" component={Main} durationInFrames={190} fps={25} width={1080} height={1920} />
);
