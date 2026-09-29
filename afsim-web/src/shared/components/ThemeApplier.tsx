/**
 * ThemeApplier — syncs theme CSS variables to :root on every theme change.
 * Renders nothing; purely a side-effect component.
 */
import { useEffect, useMemo } from 'react';
import { useThemeStore } from '../../store/themeStore';
import { getThemeById } from '../theme/themes';

export function ThemeApplier() {
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const preset = useMemo(() => getThemeById(activeThemeId), [activeThemeId]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preset.id;
    for (const [key, value] of Object.entries(preset.cssVars)) {
      root.style.setProperty(key, value);
    }
  }, [preset]);

  return null;
}
