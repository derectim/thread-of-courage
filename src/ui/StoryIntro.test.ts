import { describe, expect, it } from "vitest";

import {
  STORY_INTRO_CHAPTER_CUES,
  STORY_INTRO_CHAPTERS,
  STORY_INTRO_DURATION_SECONDS,
  resolveStoryIntroChapter,
  resolveStoryIntroChapterIndex,
} from "./StoryIntro";

describe("story intro chapter cues", () => {
  it("keeps the authored narration timing and six unique art scenes", () => {
    expect(STORY_INTRO_DURATION_SECONDS).toBe(59.851);
    expect(STORY_INTRO_CHAPTER_CUES).toEqual([
      0,
      10.47,
      17.97,
      28.07,
      37.48,
      51.05,
    ]);
    expect(STORY_INTRO_CHAPTERS).toHaveLength(6);
    expect(STORY_INTRO_CHAPTERS.map((chapter) => chapter.cue)).toEqual(
      STORY_INTRO_CHAPTER_CUES,
    );
    expect(new Set(STORY_INTRO_CHAPTERS.map((chapter) => chapter.id)).size).toBe(6);
    expect(
      new Set(STORY_INTRO_CHAPTERS.map((chapter) => chapter.artFileName)).size,
    ).toBe(6);
    expect(
      STORY_INTRO_CHAPTERS.every((chapter) =>
        /^prologue-0[1-6]-.+\.webp$/.test(chapter.artFileName),
      ),
    ).toBe(true);
  });

  it("switches chapters exactly on their narration cues", () => {
    expect(resolveStoryIntroChapterIndex(0)).toBe(0);
    expect(resolveStoryIntroChapterIndex(10.469)).toBe(0);
    expect(resolveStoryIntroChapterIndex(10.47)).toBe(1);
    expect(resolveStoryIntroChapterIndex(17.969)).toBe(1);
    expect(resolveStoryIntroChapterIndex(17.97)).toBe(2);
    expect(resolveStoryIntroChapterIndex(28.07)).toBe(3);
    expect(resolveStoryIntroChapterIndex(37.48)).toBe(4);
    expect(resolveStoryIntroChapterIndex(51.05)).toBe(5);
    expect(resolveStoryIntroChapterIndex(STORY_INTRO_DURATION_SECONDS)).toBe(5);
  });

  it("clamps invalid and out-of-range playback positions", () => {
    expect(resolveStoryIntroChapterIndex(Number.NaN)).toBe(0);
    expect(resolveStoryIntroChapterIndex(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(resolveStoryIntroChapterIndex(-30)).toBe(0);
    expect(resolveStoryIntroChapterIndex(Number.POSITIVE_INFINITY)).toBe(0);
    expect(resolveStoryIntroChapterIndex(999)).toBe(5);
  });

  it("reports stable chapter windows and normalized local progress", () => {
    expect(resolveStoryIntroChapter(5.235)).toMatchObject({
      index: 0,
      start: 0,
      end: 10.47,
      progress: 0.5,
    });
    expect(resolveStoryIntroChapter(10.47)).toMatchObject({
      index: 1,
      start: 10.47,
      end: 17.97,
      progress: 0,
    });
    expect(resolveStoryIntroChapter(STORY_INTRO_DURATION_SECONDS)).toMatchObject({
      index: 5,
      start: 51.05,
      end: STORY_INTRO_DURATION_SECONDS,
      progress: 1,
    });
  });

  it("keeps subtitles identical to the recorded narration script", () => {
    expect(STORY_INTRO_CHAPTERS.map((chapter) => chapter.title)).toEqual([
      "Нити памяти",
      "Ночь Разрыва",
      "Ожившие кошмары",
      "Последняя нить",
      "Выбор Эли",
      "Первый стежок",
    ]);
    expect(STORY_INTRO_CHAPTERS.map((chapter) => chapter.subtitle)).toEqual([
      "Когда-то каждая вещь хранила частицу своего создателя. Тёплые воспоминания вплетались в ткань, добрые слова становились узорами, а смелые поступки превращались в золотые нити. Все эти нити сходились в старой Мастерской — месте, где хранилось Сердце Великого Узора.",
      "Но однажды ночью что-то пошло не так. Главная нить оборвалась. По залам прокатился Разрыв, и забытые обиды, страхи и незаконченные узоры обрели собственную жизнь.",
      "Клубки превратились в прожорливых чудовищ. Пуговицы обзавелись глазами. Старые куклы сорвались со своих нитей. А ножницы начали охотиться на тех, кто когда-то держал их в руках. Чудовища захватили Мастерскую и унесли обрывки Великого Узора в самые тёмные её уголки.",
      "Без него ткань мира начала расползаться. Но среди оборванных нитей осталась одна, которую Разрыв не смог уничтожить. Нить храбрости.",
      "Она выбрала Элю — юную собирательницу узоров, способную услышать тихий голос старых вещей. Взяв последнюю живую иглу, Эля отправилась в глубины Мастерской. Теперь ей предстоит пройти через забытые залы, победить созданий Разрыва и вернуть похищенные части Великого Узора. Каждое точное попадание станет новым стежком.",
      "Каждая победа поможет зашить ещё одну рану этого мира. И, возможно, когда последний обрывок вернётся на своё место, Мастерская снова наполнится светом. Возьми иглу. Натяни нить. И помни… Даже самый большой разрыв можно исправить, если не бояться сделать первый стежок.",
    ]);
  });
});
