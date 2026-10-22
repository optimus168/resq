import React from 'react';
import TerraGuardApp from '../terraguard/App';
import { MapProvider } from '../terraguard/context/MapContext';
import { I18nProvider } from '../terraguard/i18n/index.tsx';
import '../terraguard/index.css';

export default function TerraGuardPage({ initialModule = 'home' }) {
  return (
    <I18nProvider>
      <MapProvider>
        <TerraGuardApp initialModule={initialModule} />
      </MapProvider>
    </I18nProvider>
  );
}
