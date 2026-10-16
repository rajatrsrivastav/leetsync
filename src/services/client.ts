import { browser } from 'wxt/browser';
import type { AppState } from '../types';
import type { Command } from './commands';
export async function send(command: Command): Promise<AppState> {
  const response = await browser.runtime.sendMessage({ channel: 'dsacommit', command });
  if (!response?.ok)
    throw new Error(response?.error || 'DSACommit is unavailable. Reload the extension and page.');
  return response.state as AppState;
}
export function dashboardUrl(section = 'preparation') {
  return browser.runtime.getURL('/dashboard.html') + '#' + section;
}
export async function openDashboard(section?: string) {
  try {
    if (typeof browser !== 'undefined' && browser.tabs?.create) {
      return await browser.tabs.create({ url: dashboardUrl(section) });
    }
  } catch {}
  return send({ type: 'openDashboard', section });
}
