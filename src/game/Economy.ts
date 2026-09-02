import { getMonsterForStage } from "./content";

/** Keeps rewards predictable: ordinary enemies give 2 thread, bosses give 3. */
export function getStageReward(stage: number): number {
  return getMonsterForStage(stage).isBoss ? 3 : 2;
}
