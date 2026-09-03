import type {
  MonsterDefinition,
  RoomDefinition,
  RoomId,
} from "./content";

export type VictoryChoice = "menu" | "continue";

export type VictoryDestination =
  | { readonly kind: "menu"; readonly persistProgress: true }
  | { readonly kind: "next-stage" };

export function getRaidStartStage(highestStageCleared: number): number {
  const clearedStage = Number.isFinite(highestStageCleared)
    ? Math.max(0, Math.floor(highestStageCleared))
    : 0;
  return clearedStage + 1;
}

export function resolveVictoryChoice(
  choice: VictoryChoice,
): VictoryDestination {
  return choice === "menu"
    ? { kind: "menu", persistProgress: true }
    : { kind: "next-stage" };
}

export function getNextStageTip(
  previousRoomId: RoomId,
  nextRoom: Pick<RoomDefinition, "id" | "name" | "subtitle">,
  nextMonster: Pick<
    MonsterDefinition,
    "name" | "epithet" | "isBoss" | "isMiniBoss"
  >,
): string {
  if (nextMonster.isBoss) {
    return `Босс: ${nextMonster.name} — ${nextMonster.epithet}`;
  }

  if (nextMonster.isMiniBoss) {
    return `Мини-босс: ${nextMonster.name} — ${nextMonster.epithet}`;
  }

  if (nextRoom.id !== previousRoomId) {
    return `${nextRoom.name}: ${nextRoom.subtitle}. Поймай новый ритм`;
  }

  return "Новый узор — следи за ритмом";
}
