import type { MonsterDefinition } from "./content";

/** Armor ricochets are nonlethal. The actual loss is always a needle collision. */
export function getDefeatAdvice(monster: Pick<MonsterDefinition, "id">, changedDirection: boolean): string {
  if (changedDirection) return "После смены направления игла попала в другую иглу. Дождись нового свободного промежутка перед выстрелом.";
  if (monster.id === "thimble-sentinel") return "Игла столкнулась с другой иглой. Шлем только отражает выстрелы: целься в свободную часть ниже брони.";
  return "Игла столкнулась с уже закреплённой иглой. Пропусти тесный промежуток и дождись более широкого.";
}
