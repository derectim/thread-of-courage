# Книга мастерской и коллекционные нашивки

Все изображения в этом наборе созданы встроенной генерацией изображений Codex
в режиме генерации нового растрового ассета. Визуальным ориентиром служил
`ui-season-album.png`: объёмный войлок, крученая пряжа, золотая вышивка, тёмный
индиго, сливочный, малиновый и тёплый золотой.

## Общая производственная часть промпта для нашивок

> Create one premium collectible embroidered cloth patch for the cozy dark-fantasy
> mobile game “Thread of Courage”. Match the supplied textile UI reference: tactile
> felt and woven fibers, raised satin-thread embroidery, tiny button or cord details,
> polished handcrafted game-icon finish, navy/cream/magenta/gold palette, readable at
> 48 px. One isolated badge only, centered, fully visible, square canvas. True
> transparent RGBA background with clean alpha edges; no checkerboard, no backdrop,
> no frame outside the patch, no text, no letters, no watermark.

Уникальная центральная тема каждого вызова:

| Файл | Уникальная тема |
| --- | --- |
| `patch-first-stitch.png` | Маленькая кремовая звезда, первый золотой стежок и малиновая пуговица. |
| `patch-copper-button.png` | Медная четырёхдырочная пуговица на индиговом круге с золотым швом. |
| `patch-patchwork-path.png` | Извилистая дорожка из разноцветных лоскутов, уходящая к золотой звезде. |
| `patch-thirteenth-loop.png` | Магическая замкнутая тринадцатая петля нити вокруг маленького напёрстка. |
| `patch-master-path.png` | Золотая игла-компас над лоскутной дорогой, знак мастера пути. |
| `patch-night-workshop.png` | Герб ночной мастерской: полумесяц, катушка и маленькое светящееся окно. |
| `patch-tailor-owl.png` | Мудрый филин-портной с глазами-пуговицами и крошечной иглой. |
| `patch-sewing-storm.png` | Спираль швейной бури из иглы, нити и бирюзовой молнии. |
| `patch-faithful-hand.png` | Серебряная ладонь, уверенно ведущая иглу через золотой стежок. |
| `patch-old-craft.png` | Костяная игла, древняя руна и тёплый янтарный узел. |
| `patch-storm-tamer.png` | Бирюзовая грозовая катушка, укрощённая золотой петлёй. |
| `patch-first-ray.png` | Солнечная игла и первый золотой луч над малиновым горизонтом. |

Для `patch-master-path.png` после первой генерации был применён отдельный режим
редактирования изображения:

> Preserve the badge exactly. Remove the baked checkerboard and every background
> pixel, producing true transparent RGBA outside the embroidered patch. Keep clean,
> antialiased alpha edges and do not alter the badge itself.

## Иллюстрация Книги мастерской

> Create a polished cozy dark-fantasy mobile-game UI illustration of an open magical
> textile collector’s book resting inside a seamstress workshop. The two fabric pages
> visibly hold embroidered patches, portrait frames, ribbons, a seasonal album and
> small sewing trophies; leave clear areas for HTML overlays that appear as the room
> levels up. Match the supplied indigo, cream, magenta and gold felt-and-thread style,
> rich tactile fibers, soft warm lamp light, front three-quarter view, no readable
> text, no letters, no watermark, wide composition suitable for a 16:8 panel.

Исходник: `ui-workshop-book.png`. Игровая версия:
`../../public/assets/art/ui-workshop-book.webp`.

Игровые WebP созданы без потерь и уменьшены до 384×384 для нашивок; исходные PNG
с прозрачностью сохранены рядом с этим файлом.
