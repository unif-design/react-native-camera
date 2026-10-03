import type {
  CameraController,
  CameraOutcome,
  CameraInput,
} from '@unif/react-native-camera';
import type { ShowcaseRoute } from '../navigation/localNavigation';

export type CameraRunRecord = {
  id: string;
  scenario: Exclude<ShowcaseRoute['name'], 'home'>;
  startedAt: string;
  endedAt: string;
  config: CameraInput;
  result: CameraOutcome;
};

export type RuntimeDiagnostic = {
  runId: string;
  scenario: CameraRunRecord['scenario'];
  message: string;
  occurredAt: string;
};

export type CameraRunSnapshot = {
  phase: 'idle' | 'opening';
  records: readonly CameraRunRecord[];
  diagnostics: readonly RuntimeDiagnostic[];
};

export type RunOutcome =
  | { accepted: true; record: CameraRunRecord; snapshot: CameraRunSnapshot }
  | { accepted: false; reason: 'busy'; snapshot: CameraRunSnapshot };

export type CameraRunController = {
  open: (
    scenario: CameraRunRecord['scenario'],
    config: CameraInput
  ) => Promise<RunOutcome>;
  close: () => void;
  getSnapshot: () => CameraRunSnapshot;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
};

export type CameraRunControllerDeps = {
  api: CameraController;
  now: () => Date;
  nextId: () => string;
};

type ActiveRun = {
  token: symbol;
  abortController: AbortController;
};

function cloneConfig(config: CameraInput): CameraInput {
  return {
    ...config,
    modes: config.modes.map((mode) => ({ ...mode })),
    ...(config.watermark
      ? {
          watermark: {
            ...config.watermark,
            lines: [...config.watermark.lines],
          },
        }
      : {}),
  };
}

function diagnosticMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  return '未知相机运行时错误';
}

export function createCameraRunController(
  deps: CameraRunControllerDeps
): CameraRunController {
  let activeRun: ActiveRun | null = null;
  let snapshot: CameraRunSnapshot = {
    phase: 'idle',
    records: [],
    diagnostics: [],
  };
  const listeners = new Set<() => void>();

  const publish = (nextSnapshot: CameraRunSnapshot) => {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };

  return {
    async open(scenario, config) {
      if (activeRun) {
        return {
          accepted: false,
          reason: 'busy',
          snapshot,
        };
      }

      const token = Symbol('camera-run');
      const runId = deps.nextId();
      const startedAt = deps.now().toISOString();
      const configSnapshot = cloneConfig(config);
      const abortController = new AbortController();
      activeRun = { token, abortController };
      publish({ ...snapshot, phase: 'opening' });

      try {
        const result = await deps.api.open(config, {
          signal: abortController.signal,
        });
        if (activeRun?.token !== token) {
          throw new Error('相机会话状态已失效');
        }

        const record: CameraRunRecord = {
          id: runId,
          scenario,
          startedAt,
          endedAt: deps.now().toISOString(),
          config: configSnapshot,
          result,
        };
        activeRun = null;
        publish({
          phase: 'idle',
          records: [...snapshot.records, record],
          diagnostics: snapshot.diagnostics,
        });

        return {
          accepted: true,
          record,
          snapshot,
        };
      } catch (reason) {
        if (activeRun?.token === token) {
          activeRun = null;
          publish({
            phase: 'idle',
            records: snapshot.records,
            diagnostics: [
              ...snapshot.diagnostics,
              {
                runId,
                scenario,
                message: diagnosticMessage(reason),
                occurredAt: deps.now().toISOString(),
              },
            ],
          });
        }
        throw reason;
      }
    },

    close() {
      if (!activeRun) {
        return;
      }
      activeRun.abortController.abort();
    },

    getSnapshot() {
      return snapshot;
    },

    clear() {
      publish({
        phase: snapshot.phase,
        records: [],
        diagnostics: [],
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
