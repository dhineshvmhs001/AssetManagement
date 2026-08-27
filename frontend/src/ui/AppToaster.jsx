import { Toaster } from 'sonner';
import { useTheme } from '../theme/ThemeProvider';

export default function AppToaster() {
  const { isDark } = useTheme();

  return (
    <Toaster
      theme={isDark ? 'dark' : 'light'}
      position="top-right"
      richColors
      closeButton
      duration={4500}
    />
  );
}
