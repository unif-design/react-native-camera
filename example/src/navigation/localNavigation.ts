export type ShowcaseRoute =
  | { name: 'home' }
  | { name: 'basic-capture' }
  | { name: 'multi-mode' }
  | { name: 'watermark-evidence' }
  | { name: 'quality-lab' };

export type NavigationState = {
  stack: ShowcaseRoute[];
};

export type NavigationAction =
  | { type: 'push'; route: ShowcaseRoute }
  | { type: 'back' }
  | { type: 'home' };

export function navigationReducer(
  state: NavigationState,
  action: NavigationAction
): NavigationState {
  switch (action.type) {
    case 'push':
      return {
        stack: [...state.stack, { ...action.route }],
      };
    case 'back':
      return state.stack.length <= 1
        ? state
        : { stack: state.stack.slice(0, -1) };
    case 'home':
      return { stack: [{ name: 'home' }] };
  }
}
