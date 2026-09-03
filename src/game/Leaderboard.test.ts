import { describe, expect, it } from "vitest";

import {
  LEADERBOARD_MAX_ROWS,
  createLeaderboardViewModel,
  normalizeLeaderboardResponse,
} from "./Leaderboard";

describe("leaderboard response normalization", () => {
  it("joins the official extended VK payload, marks the player, and sorts by level", () => {
    const rows = normalizeLeaderboardResponse(
      {
        response: {
          count: 3,
          items: [
            { user_id: 7, level: 12 },
            { user_id: 3, level: 31 },
            { user_id: 9, level: 20 },
          ],
          profiles: [
            {
              id: 3,
              first_name: "Анна",
              last_name: "Швей",
              photo_200: "https://vk.test/anna.jpg",
            },
            {
              id: 7,
              first_name: "Илья",
              last_name: "Ниткин",
              photo_100: "https://vk.test/ilya.jpg",
            },
            { id: 9, first_name: "Мира", last_name: "Лён" },
          ],
        },
      },
      { currentUserId: 9 },
    );

    expect(rows).toEqual([
      {
        id: 3,
        firstName: "Анна",
        lastName: "Швей",
        photoUrl: "https://vk.test/anna.jpg",
        level: 31,
        isCurrentUser: false,
      },
      {
        id: 9,
        firstName: "Мира",
        lastName: "Лён",
        photoUrl: "",
        level: 20,
        isCurrentUser: true,
      },
      {
        id: 7,
        firstName: "Илья",
        lastName: "Ниткин",
        photoUrl: "https://vk.test/ilya.jpg",
        level: 12,
        isCurrentUser: false,
      },
    ]);
  });

  it("accepts nested envelopes, alternate metrics, and embedded profiles", () => {
    const rows = normalizeLeaderboardResponse(
      {
        response: {
          response: {
            items: [
              {
                userId: "14",
                points: "18.9",
                profile: {
                  id: 14,
                  firstName: "Тая",
                  lastName: "Клубок",
                  photoUrl: "https://vk.test/taya.png",
                },
              },
              {
                score: 22,
                user: { id: 15, first_name: "Лев", last_name: "Шов" },
              },
            ],
          },
        },
      },
      { currentUserId: 14 },
    );

    expect(rows.map(({ id, level }) => ({ id, level }))).toEqual([
      { id: 15, level: 22 },
      { id: 14, level: 18 },
    ]);
    expect(rows[1]).toMatchObject({
      firstName: "Тая",
      lastName: "Клубок",
      photoUrl: "https://vk.test/taya.png",
      isCurrentUser: true,
    });
  });

  it("deduplicates IDs, keeps their best result, clamps values, and rejects unsafe photos", () => {
    const rows = normalizeLeaderboardResponse({
      items: [
        { user_id: 4, level: 5, first_name: "Первый" },
        {
          user_id: 4,
          level: 17.8,
          last_name: "Игрок",
          photo_100: "javascript:alert(1)",
        },
        { user_id: 5, level: -80 },
        { user_id: 6, level: Number.POSITIVE_INFINITY },
        { user_id: 0, level: 99 },
        null,
      ],
    });

    expect(rows).toEqual([
      {
        id: 4,
        firstName: "Первый",
        lastName: "Игрок",
        photoUrl: "",
        level: 17,
        isCurrentUser: false,
      },
      {
        id: 5,
        firstName: "",
        lastName: "",
        photoUrl: "",
        level: 0,
        isCurrentUser: false,
      },
      {
        id: 6,
        firstName: "",
        lastName: "",
        photoUrl: "",
        level: 0,
        isCurrentUser: false,
      },
    ]);
  });

  it("keeps normal long VK CDN photo URLs intact", () => {
    const photoUrl = `https://sun.example/vk-photo/${"a".repeat(180)}.jpg`;
    const rows = normalizeLeaderboardResponse({
      items: [{ user_id: 4, level: 5 }],
      profiles: [{ id: 4, photo_200: photoUrl }],
    });

    expect(rows[0].photoUrl).toBe(photoUrl);
  });

  it("adds only the known local player when VK has not returned their row", () => {
    const rows = normalizeLeaderboardResponse(
      {
        response: {
          items: [{ user_id: 2, level: 30 }],
          profiles: [{ id: 2, first_name: "Другой", last_name: "Игрок" }],
        },
      },
      {
        localCurrentUser: {
          id: 99,
          firstName: "Яна",
          lastName: "Игла",
          photoUrl: "https://vk.test/current.jpg",
          highestStageCleared: 21.9,
        },
      },
    );

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      id: 99,
      firstName: "Яна",
      lastName: "Игла",
      photoUrl: "https://vk.test/current.jpg",
      level: 21,
      isCurrentUser: true,
      isLocalOnly: true,
    });
  });

  it("does not replace a returned VK result with local progress", () => {
    const rows = normalizeLeaderboardResponse(
      { items: [{ user_id: 99, level: 8 }] },
      {
        localCurrentUser: {
          id: 99,
          firstName: "Яна",
          highestStageCleared: 800,
        },
      },
    );

    expect(rows).toEqual([
      {
        id: 99,
        firstName: "Яна",
        lastName: "",
        photoUrl: "",
        level: 8,
        isCurrentUser: true,
      },
    ]);
  });

  it("never returns more than twenty rows and honors a smaller limit", () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      user_id: index + 1,
      level: index + 1,
    }));

    expect(normalizeLeaderboardResponse({ items })).toHaveLength(
      LEADERBOARD_MAX_ROWS,
    );
    expect(
      normalizeLeaderboardResponse({ items }, { limit: 3 }).map(
        (row) => row.level,
      ),
    ).toEqual([30, 29, 28]);
    expect(normalizeLeaderboardResponse({ items }, { limit: 0 })).toEqual([]);
  });

  it("returns useful loading, empty, ready, and error view states", () => {
    expect(createLeaderboardViewModel("loading")).toEqual({
      status: "loading",
      rows: [],
      message: "Загружаем рейтинг…",
    });
    expect(createLeaderboardViewModel("success", { items: [] }).status).toBe(
      "empty",
    );
    expect(
      createLeaderboardViewModel("success", {
        items: [{ user_id: 1, level: 2 }],
      }).status,
    ).toBe("ready");
    expect(createLeaderboardViewModel("error").status).toBe("error");
  });

  it("fails closed for malformed or unknown API data", () => {
    expect(normalizeLeaderboardResponse(null)).toEqual([]);
    expect(normalizeLeaderboardResponse("not an object")).toEqual([]);
    expect(normalizeLeaderboardResponse({ response: { items: "bad" } })).toEqual(
      [],
    );
  });
});
