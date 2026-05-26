import { useRef } from 'react';
import { depsAreSame } from '../utils';

export function useCreation<T>(
  factory: () => T,
  deps: ReadonlyArray<unknown>
): T {
  const current = useRef<{
    deps: ReadonlyArray<unknown>;
    obj: T;
    initialized: boolean;
  }>({
    deps,
    obj: undefined as unknown as T,
    initialized: false,
  });
  if (
    !current.current.initialized ||
    !depsAreSame(deps, current.current.deps)
  ) {
    current.current.deps = deps;
    current.current.obj = factory();
    current.current.initialized = true;
  }
  return current.current.obj;
}
