import {
  navigationReducer,
  type NavigationState,
  type ShowcaseRoute,
} from '../../../example/src/navigation/localNavigation';

const routeNames = [
  'home',
  'basic-capture',
  'multi-mode',
  'watermark-evidence',
  'quality-lab',
] as const satisfies readonly ShowcaseRoute['name'][];

const allRoutesCovered: Exclude<
  ShowcaseRoute['name'],
  (typeof routeNames)[number]
> extends never
  ? true
  : never = true;

it('固定五个 showcase route 名称', () => {
  expect(allRoutesCovered).toBe(true);
  expect(routeNames).toEqual([
    'home',
    'basic-capture',
    'multi-mode',
    'watermark-evidence',
    'quality-lab',
  ]);
});

it('push 将 typed route 追加到新 stack', () => {
  const state: NavigationState = { stack: [{ name: 'home' }] };

  expect(
    navigationReducer(state, {
      type: 'push',
      route: { name: 'quality-lab' },
    })
  ).toEqual({
    stack: [{ name: 'home' }, { name: 'quality-lab' }],
  });
});

it('back 只移除当前 route', () => {
  expect(
    navigationReducer(
      {
        stack: [
          { name: 'home' },
          { name: 'basic-capture' },
          { name: 'multi-mode' },
        ],
      },
      { type: 'back' }
    )
  ).toEqual({
    stack: [{ name: 'home' }, { name: 'basic-capture' }],
  });
});

it('Android back 在根 route 不消费并保留原 state 引用', () => {
  const rootState: NavigationState = { stack: [{ name: 'home' }] };
  const nextState = navigationReducer(rootState, { type: 'back' });

  expect(nextState).toBe(rootState);
  expect(nextState).toEqual({ stack: [{ name: 'home' }] });
});

it('home 将任意 stack reset 到新的根 route', () => {
  expect(
    navigationReducer(
      {
        stack: [
          { name: 'home' },
          { name: 'watermark-evidence' },
          { name: 'quality-lab' },
        ],
      },
      { type: 'home' }
    )
  ).toEqual({ stack: [{ name: 'home' }] });
});
