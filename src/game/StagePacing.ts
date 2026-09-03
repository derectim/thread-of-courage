/**
 * Rotation pacing for the endless campaign.
 *
 * The opening stays readable, while expeditions after stage 20 gain a small
 * additional ramp. Boss and room multipliers are applied separately by the
 * scene, so this value describes only the common campaign tempo.
 */
export function getStageRotationSpeed(stage: number): number {
  const normalizedStage = Math.max(1, Math.floor(stage));
  const openingCurve =
    0.72 +
    Math.log2(normalizedStage + 1) * 0.22 +
    Math.floor(normalizedStage / 5) * 0.025;
  const lateGameRamp = Math.min(
    0.35,
    Math.max(0, normalizedStage - 20) * 0.006,
  );

  return Math.min(2.7, openingCurve + lateGameRamp);
}
