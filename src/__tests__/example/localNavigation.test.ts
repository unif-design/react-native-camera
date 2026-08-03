import {
  navigationReducer,
  type NavigationState,
  type ShowcaseRoute,
} from '../../../example/src/navigation/localNavigation';

const routeCases = [
  ['home', { name: 'home' }, { stack: [{ name: 'home' }, { name: 'home' }] }],
  [
    'basic-capture',
    { name: 'basic-capture' },
    { stack: [{ name: 'home' }, { name: 'basic-capture' }] },
  ],
  [
    'multi-mode',
    { name: 'multi-mode' },
    { stack: [{ name: 'home' }, { name: 'multi-mode' }] },
  ],
  [
    'watermark-evidence',
    { name: 'watermark-evidence' },
    { stack: [{ name: 'home' }, { name: 'watermark-evidence' }] },
  ],
  [
    'quality-lab',
    { name: 'quality-lab' },
    { stack: [{ name: 'home' }, { name: 'quality-lab' }] },
  ],
] as const satisfies readonly (readonly [
  ShowcaseRoute['name'],
  ShowcaseRoute,
  NavigationState,
])[];

type CompleteRouteCases =
  Exclude<
    ShowcaseRoute['name'],
    (typeof routeCases)[number][1]['name']
  > extends never
    ? typeof routeCases
    : never;

const completeRouteCases: CompleteRouteCases = routeCases;

it.each(completeRouteCases)(
  '%s route 由 reducer push 后可 reset 到 home',
  (_name, route, pushedState) => {
    const nextState = navigationReducer(
      { stack: [{ name: 'home' }] },
      { type: 'push', route }
    );

    expect(nextState).toEqual(pushedState);
    expect(navigationReducer(nextState, { type: 'home' })).toEqual({
      stack: [{ name: 'home' }],
    });
  }
);

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
