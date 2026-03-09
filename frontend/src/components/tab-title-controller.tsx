'use client';

import { useEffect } from 'react';
import { BRAND_NAME } from '@/lib/brand';

const HIDDEN_TITLES = ['Tu suerte...', 'empieza acá'];
const HIDDEN_TITLE_INTERVAL_MS = 2000;

export function TabTitleController() {
  useEffect(() => {
    let intervalId: number | null = null;
    let hiddenIndex = 0;

    const stopRotation = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const showBrand = () => {
      document.title = BRAND_NAME;
    };

    const startRotation = () => {
      stopRotation();
      hiddenIndex = 0;
      document.title = HIDDEN_TITLES[hiddenIndex];

      intervalId = window.setInterval(() => {
        hiddenIndex = (hiddenIndex + 1) % HIDDEN_TITLES.length;
        document.title = HIDDEN_TITLES[hiddenIndex];
      }, HIDDEN_TITLE_INTERVAL_MS);
    };

    const syncTitle = () => {
      if (document.hidden) {
        startRotation();
        return;
      }

      stopRotation();
      showBrand();
    };

    document.addEventListener('visibilitychange', syncTitle);
    syncTitle();

    return () => {
      stopRotation();
      document.removeEventListener('visibilitychange', syncTitle);
      showBrand();
    };
  }, []);

  return null;
}
