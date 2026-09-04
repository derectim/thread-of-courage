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

## Недельные эмблемы

Четыре финальные награды недельного маршрута также созданы встроенной генерацией
изображений. В каждом вызове использовались существующие нашивки только как
визуальный ориентир; требовался новый оригинальный знак, читаемый при 48 px,
объёмная вышивка из войлока и сатиновой нити, чистый настоящий alpha-канал,
без текста, шахматного фона, рамки интерфейса и водяных знаков.

| Файл | Уникальная часть промпта |
| --- | --- |
| `patch-weekly-moon-thimble.png` | Античный серебряный напёрсток с маленьким полумесяцем, звёздами и завитками нити; индиго, серебро, фиолетовый и тёплое золото. |
| `patch-weekly-golden-spool.png` | Богато украшенная золотая катушка со светящейся бирюзовой нитью и тонкой иглой; индиго, золото, бирюза и малиновые акценты. |
| `patch-weekly-owl-eye.png` | Доброе янтарное око филина из слоёв войлочных перьев, дуга напёрстка и изогнутая игла; индиго, серебро, бирюза и фиолетовый. |
| `patch-weekly-pattern-heart.png` | Лоскутное малиновое сердце, которое золотая игла завершает светящейся нитью; без крови и повреждения, с пуговицами и листьями. |

Для первого варианта после генерации отдельно применялось точное удаление
нарисованной шахматной подложки:

> Remove only the gray-and-white checkerboard outside the embroidered badge and
> replace it with genuine full transparency. Preserve the badge exactly, including
> fine edge fibers; no halo, crop, repainting, text or watermark.

У всех четырёх финальных PNG и WebP альфа-канал проверен программно; игровые
копии уменьшены до 384×384 и находятся в `../../public/assets/art/`.

## Валюты, усиления и боевые приёмы — 2026-09-03

Новый набор создан встроенной генерацией изображений Codex отдельным вызовом для
каждого ассета. Общие требования: премиальный тактильный стиль из войлока,
крученой нити, эмали и состаренной латуни; чистая прозрачность вне объекта;
читаемость на мобильном размере; без текста, букв, цифр, панели и водяного знака.

| Файлы | Краткое содержание промптов |
| --- | --- |
| `currency-thread-spool.png`, `currency-moon-button.png` | Изолированная светящаяся золотая катушка и круглая бирюзовая четырёхдырочная лунная пуговица, читаемые при 24–32 px. |
| `ability-time-loop.png`, `ability-magnetic-stitch.png`, `ability-spare-knot.png` | Круглые индиговые медальоны: игла с петлёй вокруг часов, магнитный стежок к свободному месту, защитный сердечный узел вокруг щита. |
| `upgrade-power.png`, `upgrade-precision.png`, `upgrade-speed.png`, `upgrade-ward.png` | Круглые сливовые медальоны: двойная нить, точный напёрсток, быстрый челнок, лоскутный оберег. |
| `skill-steady-hand.png`, `skill-time-seam.png`, `skill-guardian-knot.png` | Круглые бирюзовые медальоны: спокойная рука в мишени, игла сквозь песочные часы, защитный узел вокруг напёрстка. |

Игровые WebP уменьшены до 256×256 и сохраняют alpha-канал.

## Настоящие портретные рамки

Каждая рамка создана отдельным вызовом как фронтальный круглый косметический
ассет. В промптах явно требовались большой полностью прозрачный центральный
проём (около 62% ширины), прозрачность снаружи, умеренно тонкий силуэт,
читаемость при 64–120 px и отсутствие персонажа или фона.

| Файл | Вариант |
| --- | --- |
| `frame-blue-stitch.png` | Синий войлок, бирюзовые стежки, иглы и золотые узлы. |
| `frame-warm-felt.png` | Кремовые, бордовые и терракотовые лепестки войлока, пуговицы и напёрсток. |
| `frame-spool-wreath.png` | Венок из цветных миниатюрных катушек, листьев и золотого шнура. |
| `frame-golden-eye.png` | Переплетённые золотые игольные ушки с бирюзовой эмалью. |
| `frame-thread-theatre.png` | Сливовые театральные занавеси, шнуры, кисти и сценические самоцветы. |
| `frame-mechanical-lace.png` | Латунное механическое кружево, шестерни, цепочки и светлые цветы. |
| `frame-living-thread.png` | Легендарное плетение бирюзовой, малиновой и золотой живой нити с сердечными узлами. |

Игровые WebP уменьшены до 512×512; прозрачность центральных проёмов и внешнего
поля проверена после конвертации.

## Предметы комнаты

Шесть сезонных украшений созданы отдельными изолированными cutout-ассетами:
`ornament-small-spool.png`, `ornament-apprentice-scissors.png`,
`ornament-moon-pattern.png`, `ornament-golden-shuttle.png`,
`ornament-seamstress-clock.png`, `ornament-golden-machine-heart.png`.
Уникальные темы: подвеска-катушка, ножницы подмастерья, лунная выкройка,
золотой челнок, часы великой швеи и сердце золотой машины. Во всех промптах
требовались один предмет, щедрые прозрачные поля, читаемость при 56–80 px и
отсутствие комнаты, карточки, текста и водяного знака. Игровые WebP имеют
максимальную сторону 320 px и сохраняют alpha-канал.
