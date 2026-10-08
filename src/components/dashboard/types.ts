import type { AppState } from '../../types';
import type { Command } from '../../services/commands';

export type DashboardProps = {
  state: AppState;
  act: (command: Command) => Promise<AppState | undefined>;
  busy: boolean;
};
