export type Step = { id: string; title: string; active: string; status: 'pending' | 'in_progress' | 'completed' }
export type Plan = { steps: Step[] }

declare module 'claude-code' {
  interface PluginState {
    'plan-progress': { plan: Plan | null; isHidden: boolean; isExpanded: boolean }
  }
}
