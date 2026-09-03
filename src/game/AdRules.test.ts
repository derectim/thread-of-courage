import { describe, expect, it } from "vitest";

import {
  beginRewardedAbilityRequest,
  createAdCadenceState,
  createRewardedAbilityRunState,
  finishRewardedAbilityRequest,
  normalizeAdCadenceState,
  recordLoss,
} from "./AdRules";

describe("interstitial cadence", () => {
  it("requests an interstitial on exactly every third loss across modes", () => {
    let state = createAdCadenceState();
    const decisions: boolean[] = [];
    for (let loss = 1; loss <= 9; loss += 1) {
      const result = recordLoss(state);
      state = result.state;
      decisions.push(result.shouldShowInterstitial);
    }

    expect(decisions).toEqual([
      false, false, true,
      false, false, true,
      false, false, true,
    ]);
    expect(state.lossesModulo).toBe(0);
  });

  it("normalizes missing, malformed and old persisted values to modulo three", () => {
    expect(normalizeAdCadenceState(undefined)).toEqual(createAdCadenceState());
    expect(normalizeAdCadenceState({ lossesModulo: "8.9" })).toEqual({
      lossesModulo: 2,
    });
    expect(normalizeAdCadenceState({ lossesModulo: -10 })).toEqual({
      lossesModulo: 0,
    });
    expect(normalizeAdCadenceState({ campaignLossesModulo: 2 })).toEqual({
      lossesModulo: 2,
    });
  });
});

describe("one rewarded ability use per continuous run", () => {
  it("does not spend the use on cancel or error and permits another request", () => {
    const fresh = createRewardedAbilityRunState();
    const pending = beginRewardedAbilityRequest(fresh)!;
    expect(beginRewardedAbilityRequest(pending)).toBeNull();

    const cancelled = finishRewardedAbilityRequest(pending, false);
    expect(cancelled).toEqual({ requestInFlight: false, consumed: false });
    expect(beginRewardedAbilityRequest(cancelled)).not.toBeNull();
  });

  it("exhausts the ability only after a confirmed reward", () => {
    const pending = beginRewardedAbilityRequest(
      createRewardedAbilityRunState(),
    )!;
    const rewarded = finishRewardedAbilityRequest(pending, true);

    expect(rewarded).toEqual({ requestInFlight: false, consumed: true });
    expect(beginRewardedAbilityRequest(rewarded)).toBeNull();
  });

  it("restores one use only when a genuinely new run is created", () => {
    const used = finishRewardedAbilityRequest(
      beginRewardedAbilityRequest(createRewardedAbilityRunState())!,
      true,
    );
    expect(used.consumed).toBe(true);
    expect(createRewardedAbilityRunState()).toEqual({
      requestInFlight: false,
      consumed: false,
    });
  });
});
