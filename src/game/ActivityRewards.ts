import type { WorkshopCollectible } from "./WorkshopCollection";
import { activityCount, type ActivityProgress } from "./WorkshopActivities";

export const ACTIVITY_COLLECTIBLES: readonly WorkshopCollectible[] = [
  { id: "activity-patch-golden-weave", kind: "patch", source: "workshop-activity", sourceId: "patterns", name: "Нашивка «Золотое плетение»", description: "Двенадцать восстановленных узоров соединились в один цветок. Награда за все узоры мастерской.", artKey: "activity-patch-golden-weave", rarity: "epic", cosmeticOnly: true },
  { id: "activity-ornament-keepsake", kind: "workshop-ornament", source: "workshop-activity", sourceId: "drawers", name: "Шкатулка воспоминаний", description: "Бабушкина шкатулка снова хранит маленькие сокровища. Награда за шесть уровней комода.", artKey: "activity-ornament-keepsake", rarity: "rare", cosmeticOnly: true },
  { id: "activity-ornament-quilt", kind: "workshop-ornament", source: "workshop-activity", sourceId: "orders", name: "Лоскутное знамя Эли", description: "Каждый заказ оставил здесь цветной лоскут. Награда за шесть заказов Эли.", artKey: "activity-ornament-quilt", rarity: "epic", cosmeticOnly: true },
  { id: "activity-title-restorer", kind: "title", source: "workshop-activity", sourceId: "all", name: "Титул «Хранительница мастерской»", description: "Узоры, воспоминания и вещи обрели новый дом. Награда за завершение всех трёх серий мини-игр.", artKey: "activity-title-restorer", rarity: "legendary", cosmeticOnly: true },
];
export function earnedActivityCollectibles(progress: ActivityProgress): string[] {
  const patterns = activityCount(progress, "patterns") === 12, drawers = activityCount(progress, "drawers") === 6, orders = activityCount(progress, "orders") === 6;
  return ACTIVITY_COLLECTIBLES.filter(item => item.sourceId === "patterns" ? patterns : item.sourceId === "drawers" ? drawers : item.sourceId === "orders" ? orders : patterns && drawers && orders).map(item => item.id);
}

export const ACTIVITY_FINDS = [
  { id: "warm-spool", kind: "patterns" as const, after: 1, title: "Тёплая катушка", art: "currency-thread-spool.webp", text: "Под столом ждала катушка без единого узелка. Эля протянула её нить через первый узор — и дерево под ладонью стало тёплым. Мастерская узнала хозяйку." },
  { id: "garden-pattern", kind: "patterns" as const, after: 4, title: "Выкройка сада", art: "activity-patch-golden-weave.svg", text: "На обороте старой выкройки нарисован сад. Вместо дорожек — строчки, вместо цветов — нашивки. «Значит, даже сад можно вырастить по одному стежку», — решила Эля." },
  { id: "first-letter", kind: "drawers" as const, after: 1, title: "Письмо из ящичка", art: "ui-season-album.webp", text: "«Если забудешь, с чего начать, найди две похожие вещи. У одной обязательно будет история». Подписи не было. Только маленький напёрсток вместо точки." },
  { id: "forgotten-thimble", kind: "drawers" as const, after: 3, title: "Забытый напёрсток", art: "upgrade-precision.webp", text: "Напёрсток оказался слишком велик для Эли. Когда-то им пользовался тот, кто шил занавес над целым кукольным городом. Теперь он стоит на полке как крохотная башня." },
  { id: "first-order", kind: "orders" as const, after: 1, title: "Первый заказ", art: "activity-ornament-quilt.svg", text: "Мешочек для катушки вышел чуть кривоватым, но нить больше не путалась. На двери появилась записка: «Спасибо. Здесь снова умеют чинить не только вещи».", },
  { id: "owl-feather", kind: "orders" as const, after: 3, title: "Пёрышко совёнка", art: "patch-tailor-owl.webp", text: "Совёнок оставил у порога мягкое пёрышко. «За тёплую подушку и красивый флаг», — значилось на бирке. Эля приколола её над столом: пусть будущие гости знают, что здесь им рады." },
] as const;
