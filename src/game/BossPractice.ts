import { getMonsterForStage, getFirstCampaignStageForMonster, MONSTERS } from "./content";

export function getBossPracticeStage(monsterId: string, highestStageCleared: number): number | null {
  const monster = MONSTERS.find(monster => monster.id === monsterId);
  const stage = getFirstCampaignStageForMonster(monsterId);
  if (!monster || (!monster.isBoss && !monster.isMiniBoss) || stage === null || stage === undefined) return null;
  // The next encounter is already reachable, even if the player has not beaten it yet.
  return stage <= highestStageCleared + 1 && getMonsterForStage(stage).id === monsterId ? stage : null;
}
