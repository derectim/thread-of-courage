import { getFirstCampaignStageForMonster, getMonsterForStage } from "./content";

export const CAMPAIGN_CHAPTERS = [
  { bossId: "sewing-storm", title: "Тишина после бури", artFileName: "prologue-01-threads-of-memory.webp", lines: ["Буря стихла. Из-под обломков катушки потянулась тёплая золотая нить — и впервые ответила на прикосновение Эли.", "«Ты всё ещё здесь, Мастерская. Я слышу тебя. Найдём остальные нити — по одному стежку». В глубине коридора тихо зажёгся свет."] },
  { bossId: "moth-mask", title: "За чужой маской", artFileName: "prologue-03-nightmares-awake.webp", lines: ["Маска упала, и за ней оказалась маленькая выцветшая лента. Когда-то её вплетали в костюм перед самым первым выходом на сцену.", "«Ты просто боялась, что тебя забудут», — прошептала Эля. Она бережно пришила ленту к альбому. Впереди скрипнула дверь кукольного театра."] },
  { bossId: "madam-marionette", title: "Собственный шаг", artFileName: "prologue-04-last-thread.webp", lines: ["Последняя нить кукловода лопнула. Марионетка опустилась на сцену и сделала неуверенный шаг — впервые сама.", "«Теперь ты можешь выбирать дорогу». Эля улыбнулась и подхватила освободившуюся нить Великого Узора. Под полом отозвался далёкий стук машины."] },
  { bossId: "ripper", title: "Шов, который держит", artFileName: "prologue-05-elya-chosen.webp", lines: ["Распарыватель замер у края огромной трещины. Эля увидела: он снова и снова пытался убрать один старый, неровный шов.", "«Не каждый кривой стежок — ошибка. Иногда именно он держит всё вместе». Живая игла соединила края разрыва, открыв путь в забытые залы."] },
  { bossId: "queen-unraveling", title: "Нить для королевы", artFileName: "prologue-02-the-break.webp", lines: ["Корона Расплетения рассыпалась в руках Эли. В её центре осталась нить, затянутая в слишком тугой узел.", "«Не нужно удерживать весь мир одной рукой». Эля ослабила петлю. По залу пробежала волна света, и где-то впереди завёлся последний часовой механизм."] },
  { bossId: "clockwork-tailor", title: "Новый узор", artFileName: "prologue-06-first-stitch-crossbow-v2.webp", lines: ["Часовой портной положил инструменты. Сердце машины снова забилось — медленно и неровно, но уже в такт живой нити.", "«Мы не вернём всё как было. Зато сошьём что-то новое». Эля раскрыла альбом: рядом с восстановленным узором оставались чистые страницы для будущих приключений."] },
] as const;

export type CampaignChapter = (typeof CAMPAIGN_CHAPTERS)[number];
export interface CampaignStoryState { readonly seenBossIds: readonly string[]; readonly pendingBossId: string | null; }
export const createCampaignStory = (): CampaignStoryState => ({ seenBossIds: [], pendingBossId: null });
export const getCampaignChapter = (id: string | null): CampaignChapter | undefined => CAMPAIGN_CHAPTERS.find(chapter => chapter.bossId === id);

export function normalizeCampaignStory(value: unknown, highestStage: number): CampaignStoryState {
  // Earlier saves already completed these encounters; never replay a backlog.
  if (!value || typeof value !== "object") return {
    seenBossIds: CAMPAIGN_CHAPTERS.filter(chapter => (getFirstCampaignStageForMonster(chapter.bossId) ?? Infinity) <= highestStage).map(chapter => chapter.bossId), pendingBossId: null,
  };
  const raw = value as Partial<CampaignStoryState>;
  const reached = (id: string) => (getFirstCampaignStageForMonster(id) ?? Infinity) <= highestStage;
  const seenBossIds = CAMPAIGN_CHAPTERS.filter(chapter => Array.isArray(raw.seenBossIds) && raw.seenBossIds.includes(chapter.bossId) && reached(chapter.bossId)).map(chapter => chapter.bossId);
  const pending = typeof raw.pendingBossId === "string" ? getCampaignChapter(raw.pendingBossId) : undefined;
  return { seenBossIds, pendingBossId: pending && reached(pending.bossId) && !seenBossIds.includes(pending.bossId) ? pending.bossId : null };
}

export function offerCampaignStory(state: CampaignStoryState, stage: number): CampaignStoryState {
  const chapter = getCampaignChapter(getMonsterForStage(stage).id);
  return !chapter || state.pendingBossId || state.seenBossIds.includes(chapter.bossId) ? state : { ...state, pendingBossId: chapter.bossId };
}

export function finishCampaignStory(state: CampaignStoryState): CampaignStoryState {
  return !state.pendingBossId ? state : { seenBossIds: [...new Set([...state.seenBossIds, state.pendingBossId])], pendingBossId: null };
}
