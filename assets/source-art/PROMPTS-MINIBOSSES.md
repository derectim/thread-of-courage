# Промпты промежуточных боссов

Изображения созданы встроенной генерацией изображений Codex. Для каждого
персонажа исходник — квадратный PNG-лист 2x2 с настоящей прозрачностью, а четыре
ячейки — последовательные стадии повреждения одного и того же персонажа.

## Общие требования

```text
Use case: stylized-concept.
Asset type: production game character damage sprite sheet.

Create a square 2x2 sprite sheet containing exactly four full-body, front-facing
views of the exact same character, at the exact same scale and placement in every
cell. Top-left: pristine and alert. Top-right: lightly scuffed and angry.
Bottom-left: badly torn, seams strained and a little stuffing visible.
Bottom-right: exhausted and defeated but still recognizable.

Whimsical premium handcrafted textile-fantasy game art: felt, yarn, embroidery,
wood, brass, strong readable silhouette, expressive face, warm cinematic light,
high material detail, playful rather than frightening. Genuine transparent alpha
background in every cell. No room, scenery, floor, backdrop, glow plate, circular
base, cast shadow, border, frame, grid lines, text, labels, watermark, player
needles or projectiles. Leave safe transparent padding around every silhouette.
```

## Катушечный Паук

```text
Subject: a compact antique wooden thread spool wrapped in rich purple and magenta
yarn, transformed into a whimsical spider. Eight chunky poseable legs made of
stitched cloth and bent brass sewing notions, large expressive button eyes, tiny
embroidered mouth, brass fittings. Damage must accumulate naturally across the
four cells: loosened yarn, scratches, torn stitches and exposed stuffing.
```

Исходник: `miniboss-spool-spider-damage-sheet.png`

Игровые кадры: `public/assets/art/miniboss-spool-spider-0.webp` … `-3.webp`

## Лоскутный Филин

```text
Subject: a theatrical patchwork owl marionette made from midnight-blue, violet and
cream felt. Broad readable wings, embroidered feather panels, large expressive
button eyes inside a small masquerade-like fabric mask, a polished brass beak,
tiny hanging bells and restrained puppet-thread details. Damage must accumulate
naturally across the four cells: scuffs, angry brows, torn feathers, loose seams
and a little exposed stuffing.
```

Исходник: `miniboss-patchwork-owl-damage-sheet.png`

Игровые кадры: `public/assets/art/miniboss-patchwork-owl-0.webp` … `-3.webp`

## Напёрсточный Страж

```text
Subject: a squat clockwork plush guardian with an oversized antique silver thimble
helmet, quilted burgundy-and-navy torso, spool shoulder joints, stitched arms and
legs, small brass mechanisms and a glowing teal thread core in the chest. No held
weapon and no long spikes. Damage must accumulate naturally across the four cells:
dents, an angrier expression, torn quilt panels, loose thread and visible stuffing.
```

Исходник: `miniboss-thimble-sentinel-damage-sheet.png`

Игровые кадры: `public/assets/art/miniboss-thimble-sentinel-0.webp` … `-3.webp`
