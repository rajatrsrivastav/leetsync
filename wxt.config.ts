import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Load the unpacked development output in your chosen browser/profile.
  webExt: { disabled: true },
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'DSACommit',
    description:
      'Track campus preparation, study resources, DSA progress, revisions, and GitHub sync locally.',
    permissions: ['storage', 'alarms'],
    optional_host_permissions: ['https://api.github.com/*'],
    options_ui: { page: 'dashboard.html', open_in_tab: true },
    commands: {
      _execute_action: { suggested_key: { default: 'Alt+Shift+D' }, description: 'Open DSACommit' },
      'toggle-timer': { description: 'Start or pause the current timer' },
      'add-hint': { description: 'Record a hint for the current attempt' },
      'next-problem': { description: 'Open your next DSA problem' },
    },
    icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  },
});
