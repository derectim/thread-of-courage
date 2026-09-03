import { getMonsterForStage } from "./content";

/** Keeps rewards predictable: ordinary enemies give 2 thread, tougher encounters give 3. */
export function getStageReward(stage: number): number {
  const monster = getMonsterForStage(stage);
  return monster.isBoss || monster.isMiniBoss ? 3 : 2;
}
