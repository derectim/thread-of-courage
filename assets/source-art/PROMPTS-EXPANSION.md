# Промпты расширения

Режим для всех изображений: встроенный генератор Codex `image_gen`.

Фон удалялся только у игровых спрайтов. После генерации прозрачность проверена
по альфа-каналу; запечённая шахматка на листах повреждений была удалена
механически связной маской от краёв.

## Эля Штопка

Итоговый исходник: `hero-elya-cutout.png`.

~~~text
Use case: stylized-concept
Asset type: production-ready transparent 2D mobile game hero sprite
Input images: Image 1 is only a material/style reference for real felt, yarn, stitched fabric and the established plum-teal-cream-gold palette
Primary request: one original heroine, Эля Штопка, a brave young adult seamstress archer holding a compact handmade spring bow called «Стежок»
Subject: full-body young woman with plum yarn braid, friendly determined face, dusty-teal short cape, coral quilted tunic, cream sleeves, dark loose trousers, sturdy boots and a spool satchel; both hands hold a compact carved-wood and brass bow with a silver sewing needle nocked upward
Style/medium: handcrafted felt doll and embroidered fabric game sprite, tactile fibers, charming cozy dark fantasy, clean readable silhouette, simplified enough to read at small mobile size
Composition/framing: centered upright front three-quarter pose, full body and complete weapon visible, generous empty transparent padding
Lighting/mood: neutral soft diffuse light with no glow and no cast shadow
Constraints: output must contain true transparent alpha outside the character and bow, not a checkerboard pattern and not a colored background; exactly one character; no environment; no backdrop; no aura; no ground; no shadow; no text; no UI; no extra objects; no logos; no watermark
~~~

## Эля Штопка — динамичная боевая поза

Итоговый исходник: hero-elya-action-v2-cutout.png.

~~~text
Use case: identity-preserve
Asset type: production-ready transparent 2D mobile game heroine sprite
Input images: Image 1 is the exact heroine identity, outfit, weapon and material anchor; Image 2 is the established handcrafted game-world style reference only
Primary request: redraw the same original heroine Эля Штопка in a much more dynamic combat pose for the bottom of a portrait arcade game
Subject: preserve her plum yarn braid, friendly determined face, dusty-teal stitched cape, coral quilted tunic, cream sleeves, dark loose trousers, boots, spool satchel, and the exact carved-wood-and-brass spring bow «Стежок» with a silver sewing needle; she is now leaning diagonally into the shot with torso twisted, one knee bent forward, the rear leg braced, cape and braid sweeping sideways, both hands actively drawing the bow upward toward the target; energetic readable action silhouette, still balanced and believable
Style/medium: preserve the tactile handcrafted felt doll, yarn, embroidery, carved wood and subtle watercolor look of Image 1; cozy dark fantasy; clean mobile-game readability
Composition/framing: one full-body character in a strong three-quarter action stance, diagonal gesture rather than straight upright symmetry; entire body, both feet, both hands, complete bow and nocked needle fully visible; centered with generous transparent padding; designed to sit in the lower-center of a portrait screen without hiding the target
Lighting/mood: neutral soft object lighting; brave, focused and lively
Constraints: change only pose, gesture and cloth/hair motion; preserve character identity, facial features, age, proportions, outfit colors and weapon design; genuine transparent alpha outside the character and bow; no white, gray, colored or checkerboard background; no ground, no cast shadow, no aura, no environment, no text, no UI, no extra characters, no extra weapons, no flying projectile, no logos, no watermark
~~~

## Великая Швейная Буря — базовый образ

Итоговый исходник: `boss-sewing-storm.png`.

~~~text
Use case: stylized-concept
Asset type: transparent 2D mobile game boss sprite
Input images: Image 1 is the established material and palette reference only
Primary request: create the original boss «Великая Швейная Буря», an enchanted patchwork quilt rolled into a compact spinning nightmare around one enormous brass button eye
Subject: one nearly circular layered quilt creature, overlapping felt flaps like protective armor, visible stitches and seams, one central expressive button eye, three mustard-gold vulnerable seam marks, small loose coral threads whipping around the rim
Style/medium: charming handcrafted felt, embroidery, cut-paper and watercolor game art matching Image 1; cozy dark fantasy; tactile fibers; readable at small size
Composition/framing: front-facing centered compact circular silhouette designed to rotate as a target; generous transparent padding
Lighting/mood: warm attic light, imposing but whimsical
Color palette: night blue, dusty teal, cream, coral, mustard gold, plum
Constraints: true transparent alpha, exactly one creature, no environment, no backdrop, no checkerboard, no shadow, no text, no UI, no weapons, no arrows, no logos, no watermark
~~~

## Мадам Марионетка — базовый образ

Итоговый исходник: `boss-madam-marionette-cutout.png`.

~~~text
Use case: stylized-concept
Asset type: transparent 2D mobile game boss sprite
Input images: Image 1 is the established material and palette reference only
Primary request: create the original boss «Мадам Марионетка», a grand haunted puppet head from a forgotten toy theatre
Subject: one compact nearly circular doll-face boss framed by plum felt curls and a faded velvet ruff, cream fabric face with stitched cracks, dramatic button eyes, small wooden crown, two short puppet strings curling close to the silhouette, one sly theatrical expression
Style/medium: charming handcrafted felt doll, embroidery, cut paper and subtle watercolor game art matching Image 1; cozy theatrical dark fantasy; tactile fibers
Composition/framing: front-facing centered circular target silhouette designed to rotate and swing; generous transparent padding; readable at small mobile size
Lighting/mood: cool moonlit theatre light, elegant and mischievous
Color palette: theatrical plum #8A5578, night blue, dusty teal, cream, coral and muted gold
Constraints: true transparent alpha, exactly one boss head, no body, no environment, no backdrop, no checkerboard, no cast shadow, no text, no UI, no arrows, no logos, no watermark
~~~

## Распарыватель — базовый образ

Итоговый исходник: `boss-ripper-cutout.png`.

~~~text
Use case: stylized-concept
Asset type: transparent 2D mobile game boss sprite
Input images: Image 1 is the established material and palette reference only
Primary request: create the original boss «Распарыватель», a living antique sewing-machine mechanism built around a spinning flywheel
Subject: one compact circular brass-and-dark-wood machine monster, huge flywheel forming the outer silhouette, one turquoise glowing eye in the hub, black yarn wound through gears, small seam-ripper teeth around part of the rim, stitched felt patches caught in the mechanism
Style/medium: handcrafted brass, carved wood, felt, embroidery and cut-paper watercolor game art matching Image 1; cozy mechanical dark fantasy; readable at small size
Composition/framing: front-facing centered nearly circular target silhouette designed to rotate; generous transparent padding
Lighting/mood: electric turquoise sparks, ominous workshop energy without a surrounding glow
Color palette: dark brass, night blue, black plum, cream, coral, electric turquoise #39B7A5
Constraints: true transparent alpha, exactly one compact machine creature, no environment, no backdrop, no checkerboard, no cast shadow, no text, no UI, no arrows, no logos, no watermark
~~~

## Театр забытых кукол

Итоговый исходник: `room-puppet-theatre.png`.

~~~text
Use case: stylized-concept
Asset type: portrait 9:16 mobile game room background
Input images: Image 1 is the established visual-style reference only; match its handcrafted felt, embroidery, cut-paper, aged wood and subtle watercolor texture, but create a completely new room
Primary request: create the original room «Театр забытых кукол», an abandoned miniature puppet theatre prepared as a clear combat arena
Scene/backdrop: deep old theatre stage with faded plum velvet curtains, layered cut-paper scenery, dangling empty puppet strings, dusty wooden floorboards, small toy-stage balconies, stitched fabric stars and a pale round moon-window; no living characters or puppets
Subject: atmospheric empty theatre room with a broad uncluttered central vertical play area for a rotating monster target and projectiles
Style/medium: charming handcrafted felt, thread, cut paper and watercolor game illustration; cozy theatrical dark fantasy; tactile fibers; visually consistent with Image 1
Composition/framing: strict portrait 9:16; centered symmetrical stage; quiet open combat area through the middle; upper area calm and readable for an overlaid HUD; decorative details stay mainly along edges and background; foreground ledge at bottom
Lighting/mood: cool moonlit stage with soft warm footlights, mysterious but inviting
Color palette: theatrical plum #8A5578, night blue #25324A, dusty teal #5B8C85, fabric cream #F2E3C6, coral #E56B6F and muted mustard gold #E8B44D
Constraints: environment background only; no characters; no monsters; no visible puppets; no people; no text; no letters; no UI; no icons; no logos; no watermark; no framing border; no checkerboard
~~~

## Сердце швейной машины

Итоговый исходник: `room-sewing-machine-heart.png`.

~~~text
Use case: stylized-concept
Asset type: portrait 9:16 mobile game room background
Input images: Image 1 is the established style, material, palette, portrait composition and gameplay-background reference; create a different room in the same handcrafted world, do not copy its layout literally
Primary request: create the original room «Сердце швейной машины», a vast underground chamber inside a living antique sewing mechanism
Scene/backdrop: towering dark carved-wood frames, immense brass flywheels and interlocking gears along the side walls, black yarn running through copper guides, stitched felt panels and thread conduits, a softly glowing turquoise power core deep in the upper background; clear open central combat arena from upper-middle through lower-middle; a sturdy workbench edge only at the very bottom
Subject: the empty mechanical sewing chamber itself; no creature and no character
Style/medium: charming handcrafted layered felt, embroidery, cut paper, carved wood, aged brass and subtle watercolor grain; cozy mechanical dark fantasy; same tactile visual language and polish as Image 1
Composition/framing: strict portrait 9:16, centered one-point perspective, strong side framing, uncluttered central play area, darker quiet zone at the top for HUD, gameplay-safe negative space
Lighting/mood: moody underground workshop; warm amber reflections on brass mixed with restrained electric turquoise light; mysterious, magical, readable
Color palette: night blue #25324A, dark plum-black, aged brass, copper, cream felt, coral thread accents, electric turquoise #39B7A5
Constraints: environment background only; no people; no monsters; no boss; no silhouettes; no text; no letters; no numbers; no UI; no icons; no logos; no watermark; no foreground object blocking the central arena
~~~

## Великая Швейная Буря — четыре стадии повреждения

Итоговый исходник: `boss-sewing-storm-damage-sheet.png`.

~~~text
Use case: identity-preserve
Asset type: production-ready 2D mobile game boss damage sprite sheet, one square image arranged as a precise 2 by 2 atlas
Input images: Image 1 is the edit target and exact character anchor for «Великая Швейная Буря»; preserve its identity, circular silhouette, central brass button eye, patchwork layering, felt fibers, stitched seams, palette, proportions and front-facing viewpoint
Primary request: create four maximally consistent states of this same single boss, one complete boss centered inside each equal quadrant. Top-left: undamaged and focused, tightly closed seams, stern concentrated button-eye expression. Top-right: angry after a hit, central eye visibly furious, loose coral threads flaring upward and outward but staying fully inside the quadrant. Bottom-left: visibly battered, several seams split open, fabric patches rumpled, a few loose stitches and small tears, exhausted angry expression. Bottom-right: almost completely unstitched and near defeat, major seams opened, layers sagging and frayed, many threads loose, central button eye distressed and furious, but the creature remains one readable circular target and does not fall apart outside its quadrant.
Style/medium: preserve exactly the handcrafted layered felt, embroidery, cut-paper and subtle watercolor game-art style of Image 1; tactile fibers; cozy dark fantasy; game-ready readability at small size
Composition/framing: exact 2 by 2 layout with four equal invisible quadrants; same scale, same center alignment, same front-facing circular pose and nearly identical outer dimensions in all four cells; every full figure and every loose thread must stay safely inside its own quadrant with generous transparent padding; no overlaps between cells
Scene/backdrop: genuinely transparent alpha everywhere outside the four creatures
Lighting/mood: same neutral soft lighting across all four states
Constraints: edit only expression, thread motion and progressive damage; do not redesign the character; exactly four depictions of the same boss; true transparent background, not white and not a baked checkerboard; no room, no scenery, no floor, no cast shadows, no glows, no labels, no text, no numbers, no frames, no grid lines, no separators, no UI, no logos, no watermark; do not crop any part of any state
~~~

## Мадам Марионетка — четыре стадии повреждения

Итоговый исходник: `boss-madam-marionette-damage-sheet.png`.

~~~text
Use case: identity-preserve
Asset type: production-ready 2D mobile game boss damage sprite sheet, exactly 2 columns by 2 rows
Input images: Image 1 is the character anchor and edit target; preserve the exact same original boss identity, circular silhouette, face proportions, plum yarn curls, cream felt face, crown, button eyes, navy ruff, puppet strings, materials and palette
Primary request: create exactly four highly consistent damage/emotion states of «Мадам Марионетка» on one transparent 2x2 sprite-sheet canvas
State order: top-left = calm and sly, pristine; top-right = angry, lowered stitched brows and tense mouth, very light scuffs; bottom-left = visibly battered, one loose curl, cracked stitches, rumpled ruff, furious/tired expression; bottom-right = almost ripped apart but still readable and non-gory, torn felt seams, loose stuffing threads, crooked crown, one damaged button eye, exhausted enraged expression
Style/medium: preserve the handcrafted felt doll, yarn, embroidery, cut-paper and subtle watercolor look of Image 1
Composition/framing: four equal square cells in an implicit 2x2 grid; one complete front-facing boss head centered in each cell; identical size, pose, camera, silhouette footprint and pivot point across all four states; generous fully transparent padding and equal gutters; every crown tip, curl, string and ruff edge remains fully inside its own cell
Progression: damage increases clearly and monotonically from top-left to bottom-right; change only expression and believable wear, never redesign the character
Constraints: true transparent alpha everywhere outside the four figures; do not draw a checkerboard; no white or colored background; exactly four boss figures; no labels; no text; no numbers; no grid lines; no panel borders; no environment; no props; no ground; no cast shadows; no glow; no logos; no watermark; no extra detached objects
~~~

## Распарыватель — четыре стадии повреждения

Итоговый исходник: `boss-ripper-damage-sheet.png`.

~~~text
Use case: identity-preserve
Asset type: production-ready 2D mobile game boss damage sprite sheet, exact 2 columns by 2 rows
Input images: Image 1 is the edit target and sole character anchor for «Распарыватель»; preserve this exact boss design, circular silhouette, turquoise eye, brass-and-dark-wood mechanism, black yarn, stitched patches and rim teeth
Primary request: create one square sprite sheet containing four maximally consistent damage states of the same boss, ordered left-to-right and top-to-bottom: 1 intact and alert; 2 angry with narrowed turquoise eye and small contained turquoise sparks; 3 visibly damaged with bent teeth, cracked brass plates, loose black yarn and an exhausted angry eye; 4 almost falling apart with broken gear segments, torn patches, frayed yarn, dim furious eye, but still clearly the exact same boss
Style/medium: preserve the handcrafted brass, carved wood, felt, embroidery and cut-paper watercolor game-art style of Image 1 exactly
Composition/framing: exact 2x2 grid layout without visible grid lines; each state centered inside its own equal square cell; identical character scale, center position, facing, camera angle and circular pose in all four cells; every complete figure including teeth, sparks, loose yarn and fragments stays fully inside its cell with generous transparent padding; no overlap or spill between cells
Lighting/mood: preserve the same neutral object lighting; only damage and facial emotion progress
Color palette: preserve Image 1 colors exactly; turquoise #39B7A5 remains the eye and spark accent
Constraints: change only damage and facial expression from cell to cell; do not redesign the boss; true transparent alpha everywhere outside the four figures; transparency must not be represented by painted white, gray, checkerboard or any background pixels; exactly four figures and exactly four states; no scene; no backdrop; no floor; no cast shadows; no separator lines; no cell borders; no labels; no text; no numbers; no UI; no arrows; no extra creatures; no logos; no watermark
~~~

## Клубок-Ворчун — четыре стадии повреждения

Итоговый исходник: grumble-yarn-damage-sheet.png.

~~~text
Use case: identity-preserve
Asset type: production-ready 2D mobile game enemy damage sprite sheet, one square image arranged as a precise 2 by 2 atlas
Input images: Image 1 is the edit target and exact character anchor for «Клубок-Ворчун»; preserve its identity, round ball-of-yarn silhouette, plum yarn strands, cream felt eye patches, dark button eyes, coral button nose, navy stitched eyebrow and repair patches, mustard loose curls, handcrafted proportions and front-facing viewpoint
Primary request: create four maximally consistent states of this same single yarn monster, one complete monster centered inside each equal quadrant. Top-left: calm but grumpy and focused, tightly wound yarn, familiar skeptical frown. Top-right: angry after several stitch hits, button eyes furious, stitched eyebrows sharply lowered, a few mustard curls and plum strands raised in irritation. Bottom-left: visibly battered and disheveled, several yarn loops loosened, repair patches skewed, small frayed strand ends, tired but still angry expression. Bottom-right: almost unwound and exhausted near defeat, outer yarn loops sagging and partly unraveled, more loose ends and fraying, patched face still readable, button eyes weary and distressed, but the creature remains one compact round target and does not collapse outside its quadrant.
Style/medium: preserve exactly the handcrafted thick yarn, felt, embroidery and subtle watercolor game-art style of Image 1; tactile fibers; cozy dark fantasy; clean game-ready readability at small size
Composition/framing: exact 2 by 2 layout with four equal invisible quadrants; same scale, same center alignment, same front-facing round pose and nearly identical outer dimensions in all four cells; every full figure and every loose strand must stay safely inside its own quadrant with generous transparent padding; no overlaps between cells
Scene/backdrop: genuinely transparent alpha everywhere outside the four creatures
Lighting/mood: identical neutral soft lighting across all four states
Constraints: edit only facial expression, strand motion and progressive damage; do not redesign the character; exactly four depictions of the same monster; true transparent background, not white and not a baked checkerboard; no room, no scenery, no floor, no cast shadows, no glows, no arrows, no needles, no labels, no text, no numbers, no frames, no grid lines, no separators, no UI, no logos, no watermark; do not crop any part of any state
~~~
