export const LOSSES_PER_INTERSTITIAL = 3 as const;

export type LossModulo = 0 | 1 | 2;

export interface AdCadenceState {
  /** Persisted modulo counter; zero means the last counted loss was the third. */
  readonly lossesModulo: LossModulo;
}

export interface LossCadenceResult {
  readonly state: AdCadenceState;
  readonly shouldShowInterstitial: boolean;
}

export interface RewardedAbilityRunState {
  readonly requestInFlight: boolean;
  readonly consumed: boolean;
}

function normalizeInteger(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

export function createAdCadenceState(): AdCadenceState {
  return { lossesModulo: 0 };
}

/** Safely accepts old saves that do not contain advertising cadence yet. */
export function normalizeAdCadenceState(value: unknown): AdCadenceState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return createAdCadenceState();
  }
  const record = value as Record<string, unknown>;
  const raw = record.lossesModulo ?? record.campaignLossesModulo;
  return {
    lossesModulo: (normalizeInteger(raw) %
      LOSSES_PER_INTERSTITIAL) as LossModulo,
  };
}

/** Counts every completed defeat and schedules an interstitial on every third one. */
export function recordLoss(
  state: AdCadenceState,
): LossCadenceResult {
  const current = normalizeAdCadenceState(state).lossesModulo;
  const next = (current + 1) % LOSSES_PER_INTERSTITIAL;
  return {
    state: { lossesModulo: next as LossModulo },
    shouldShowInterstitial: next === 0,
  };
}

/** A fresh instance is created only when a new campaign or weekly run begins. */
export function createRewardedAbilityRunState(): RewardedAbilityRunState {
  return { requestInFlight: false, consumed: false };
}

/** Locks concurrent taps without spending the run's use. */
export function beginRewardedAbilityRequest(
  state: RewardedAbilityRunState,
): RewardedAbilityRunState | null {
  if (state.consumed || state.requestInFlight) return null;
  return { ...state, requestInFlight: true };
}

/** Cancel/error unlocks another attempt; only a confirmed reward consumes the use. */
export function finishRewardedAbilityRequest(
  state: RewardedAbilityRunState,
  rewarded: boolean,
): RewardedAbilityRunState {
  if (!state.requestInFlight) return state;
  return {
    requestInFlight: false,
    consumed: rewarded || state.consumed,
  };
}
