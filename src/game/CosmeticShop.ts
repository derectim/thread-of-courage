import type { WorkshopCollectible } from "./WorkshopCollection";

export interface CosmeticShopOffer {
  readonly cost: number;
  readonly collectible: WorkshopCollectible;
}

/** Guaranteed cosmetics, bought once; they never change combat statistics. */
export const COSMETIC_SHOP_OFFERS: readonly CosmeticShopOffer[] = [
  { cost: 500, collectible: { id: "fragment-title-spark-keeper", kind: "title", source: "fragment-shop", sourceId: "spark-keeper", name: "Титул «Хранительница искр»", description: "Новая подпись под твоим именем в профиле и рейтинге.", artKey: "fragment-title-spark-keeper", rarity: "common", cosmeticOnly: true } },
  { cost: 1200, collectible: { id: "fragment-glow-mint-silk", kind: "name-glow", source: "fragment-shop", sourceId: "mint-silk", name: "Свечение «Мятный шёлк»", description: "Имя загорается мягким бирюзовым светом.", artKey: "fragment-glow-mint-silk", rarity: "rare", cosmeticOnly: true } },
  { cost: 2500, collectible: { id: "fragment-trail-velvet-thorn", kind: "needle-trail", source: "fragment-shop", sourceId: "velvet-thread", name: "След «Малиновый стежок»", description: "В полёте за любой выбранной иглой тянется малиновая нить с золотым отблеском.", artKey: "fragment-trail-velvet-thorn", rarity: "epic", cosmeticOnly: true } },
  { cost: 4000, collectible: { id: "fragment-aura-moonweave", kind: "needle-aura", source: "fragment-shop", sourceId: "moon-hoop", name: "Сияние «Лунный обруч»", description: "Летящую иглу окружает серебристо-голубое сияние.", artKey: "fragment-aura-moonweave", rarity: "epic", cosmeticOnly: true } },
];

export function getCosmeticShopOffer(id: string): CosmeticShopOffer | undefined {
  return COSMETIC_SHOP_OFFERS.find((offer) => offer.collectible.id === id);
}
