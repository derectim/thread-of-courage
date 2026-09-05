import type { ProgressionState } from "./ProgressionStore";
import { ACTIVE_ABILITIES } from "./ActiveAbilities";
import { COSMETIC_SHOP_OFFERS, getCosmeticShopOffer, type CosmeticShopOffer } from "./CosmeticShop";
import { getCampaignChapter } from "./CampaignStory";
import { getDetourReward } from "./CampaignDetour";
import { NEEDLE_SKINS, SKILLS } from "./meta";
import { getMonsterForStage } from "./content";
import { getClaimableSeasonPassRewards, getSeasonPassStatus } from "./SeasonPass";
import { getDailyQuestDefinition, normalizeDailySystemsState } from "./DailySystems";

export interface NextGoal {
  readonly title: string;
  readonly detail: string;
  readonly progress: number;
  readonly target: number;
  readonly destination: "run" | "cosmetics" | "season" | "daily" | "needles" | "talents" | "abilities";
  readonly buttonLabel: string;
  readonly iconFileName: string;
  readonly ready: boolean;
}

/** One actionable goal: earned rewards first, then a nearby unlock or a visible collection target. */
export function getNextGoal(state: ProgressionState): NextGoal {
  const chapter = getCampaignChapter(state.campaignStory.pendingBossId);
  if (chapter) return { title: chapter.title, detail: "Победа сохранена. Узнай, что Эля нашла после боя.", progress: 1, target: 1, destination: "run", buttonLabel: "К истории", iconFileName: "ui-season-album.webp", ready: true };
  if (state.campaignBoons.pendingBossStage !== null) return {
    title: "Выбери узор похода", detail: `Босс этапа ${state.campaignBoons.pendingBossStage} побеждён. Тебя ждёт бонус.`,
    progress: 1, target: 1, destination: "run", buttonLabel: "Выбрать", iconFileName: "upgrade-power.webp", ready: true,
  };
  if (state.campaignDetour) return { title: state.campaignDetour.status === "active" ? "Испытание у тайника" : "Тайник на развилке", detail: state.campaignDetour.status === "active" ? "Дополнительный бой ждёт. Основной путь продолжится после победы." : `Пройти мимо или рискнуть ради ${getDetourReward(state.campaignDetour.stage)} нитей?`, progress: 1, target: 1, destination: "run", buttonLabel: state.campaignDetour.status === "active" ? "К бою" : "Выбрать", iconFileName: "ui-streak-chest.webp", ready: true };
  const pinned = state.cosmeticGoalId ? getCosmeticShopOffer(state.cosmeticGoalId) : undefined;
  if (pinned && !state.workshopCollection.ownedCollectibleIds.includes(pinned.collectible.id)) return cosmeticGoal(pinned, state.thread);
  const claimable = getClaimableSeasonPassRewards(state.seasonPass);
  if (claimable.length) return { title: "В альбоме ждёт награда", detail: `Украшений можно забрать: ${claimable.length}`,
    progress: 1, target: 1, destination: "season", buttonLabel: "К награде", iconFileName: "ui-season-album.webp", ready: true };
  const daily = normalizeDailySystemsState(state.dailySystems);
  if (daily.streak.pendingChests.length || daily.daily.quests.some((quest) => !quest.claimed && quest.progress >= getDailyQuestDefinition(quest.id).criteria.target)) {
    return { title: "Награда за старания", detail: "Забери заработанное в поручениях.", progress: 1, target: 1,
      destination: "daily", buttonLabel: "Забрать", iconFileName: "ui-streak-chest.webp", ready: true };
  }
  const offer = COSMETIC_SHOP_OFFERS.find(({ collectible }) => !state.workshopCollection.ownedCollectibleIds.includes(collectible.id));
  if (offer && state.thread >= offer.cost) return { title: offer.collectible.name, detail: `Нитей хватает: ${state.thread} / ${offer.cost}`,
    progress: offer.cost, target: offer.cost, destination: "cosmetics", buttonLabel: "В лавку", iconFileName: "menu-icon-shop.webp", ready: true };

  const milestones: NextGoal[] = [
    ...NEEDLE_SKINS.filter((needle) => needle.unlockKind === "stage" && !state.ownedNeedles.includes(needle.id)).map((needle): NextGoal => ({
      title: needle.name, detail: `Победи на этапе ${needle.unlockStage}, чтобы открыть иглу.`, progress: Math.min(state.highestStageCleared, needle.unlockStage ?? 0), target: needle.unlockStage ?? 1,
      destination: "needles", buttonLabel: "К иглам", iconFileName: needle.iconFileName, ready: false,
    })),
    ...SKILLS.filter((skill) => !state.unlockedSkills.includes(skill.id)).map((skill): NextGoal => ({
      title: skill.name, detail: `Новый талант за этап ${skill.unlockStage}.`, progress: Math.min(state.highestStageCleared, skill.unlockStage), target: skill.unlockStage,
      destination: "talents", buttonLabel: "К талантам", iconFileName: "menu-icon-upgrades.webp", ready: false,
    })),
    ...ACTIVE_ABILITIES.filter((ability) => ability.unlockStage > Math.max(1, state.highestStageCleared)).map((ability): NextGoal => ({
      title: ability.name, detail: `Новый боевой приём за этап ${ability.unlockStage}.`, progress: state.highestStageCleared, target: ability.unlockStage,
      destination: "abilities", buttonLabel: "К приёмам", iconFileName: ability.iconFileName, ready: false,
    })),
  ].sort((left, right) => left.target - right.target);
  const milestone = milestones[0];
  if (milestone && milestone.target - state.highestStageCleared <= 2) return milestone;
  if (offer && state.thread > 0) return {
    title: offer.collectible.name, detail: `Нити: ${state.thread} / ${offer.cost} · за победы и поручения`,
    progress: state.thread, target: offer.cost, destination: "cosmetics", buttonLabel: "Посмотреть", iconFileName: "menu-icon-shop.webp", ready: false,
  };
  const season = getSeasonPassStatus(state.seasonPass);
  if (state.highestStageCleared >= 5 && season.xpForNextTier !== null) return {
    title: `Украшение уровня ${season.unlockedTier + 1}`, detail: `Опыт альбома: ${season.xpIntoTier} / ${season.xpForNextTier} XP`,
    progress: season.xpIntoTier, target: season.xpForNextTier, destination: "season", buttonLabel: "В альбом", iconFileName: "ui-season-album.webp", ready: false,
  };
  const currentStage = Math.max(1, state.campaignResumeStage);
  const bossStage = Array.from({ length: 10 }, (_, index) => currentStage + index).find((stage) => getMonsterForStage(stage).isBoss) ?? currentStage;
  return { title: `Босс впереди · этап ${bossStage}`, detail: `${getMonsterForStage(bossStage).name} · ещё побед: ${bossStage - currentStage + 1}`,
    progress: currentStage - 1, target: bossStage, destination: "run", buttonLabel: "В путь", iconFileName: "menu-icon-bestiary.webp", ready: false };
}

function cosmeticGoal(offer: CosmeticShopOffer, thread: number): NextGoal {
  const ready = thread >= offer.cost;
  return { title: offer.collectible.name, detail: ready ? `Нитей хватает: ${thread} / ${offer.cost}` : `Нити: ${thread} / ${offer.cost} · осталось ${offer.cost - thread}`,
    progress: Math.min(thread, offer.cost), target: offer.cost, destination: "cosmetics", buttonLabel: ready ? "В лавку" : "К цели", iconFileName: "menu-icon-shop.webp", ready };
}
