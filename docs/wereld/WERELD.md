# BADI Wereld

Een wereld binnen de Badi-app waarin wij met z'n vieren (Bram, Anne, Daphne, Irene) rondlopen, elkaar privé berichten sturen en samen iets opbouwen. Doel: het gebruik van Badi stimuleren. Echte acties in de app (trainen, inchecken, Winter Arc, Weekrad) zijn de motor van de wereld.

## Uitgangspunten

- De wereld is de beloning voor wat je in het echt doet, geen los spel ernaast.
- Geen ranglijsten of competitie. Alles is samenwerken, net als de rest van Badi.
- Moet werken als je alleen bent: wat anderen deden blijft zichtbaar.
- Een bezoek duurt 30 seconden tot 2 minuten.
- Privé is technisch privé: de server bepaalt wie wat mag lezen, niet de app.
- Stijl: de bestaande Badi-stijl (kleuren, Fraunces, Geist, assets in public/brand).
- Mobiel eerst. Alles moet met een duim te bedienen zijn.

## Basis en referentie

- **De basis is de BADI Wereld die al in de app staat**: het bestaande concept met onze eigen getekende poppetjes. Daarop bouwen we verder. Gooi die niet weg en vervang de stijl niet.
- **Het uiterlijk komt van onze poppetjes** (zie hieronder) en getekende achtergronden in dezelfde stijl. Nooit platte vormen, blokjes of in code getekende poppetjes.
- `docs/wereld/prototype.html` is **alleen een referentie voor de werking**: lopen via tegels, deuren naar binnen en buiten, zitten, diepte (achter dingen langs lopen) en wie waar is. Neem niets over van het uiterlijk van het prototype: niet de kleuren, niet de gebouwen en zeker niet de poppetjes. De aanwezigheid en chat daarin zijn ook niet privé.

## Poppetjes

We hebben vaste, getekende poppetjes per persoon in `public/wereld/poppetjes/<naam>/`: losse transparante frames van 320 x 272 pixels.

| Animatie | Gebruik in de wereld |
|---|---|
| staan | stilstaan |
| lopen | lopen (naar links = gespiegeld) |
| zitten | op een stoel of bank |
| slapen | offline, of rustdag geregistreerd |
| zwaaien | high five of groeten |
| juichen | training gedaan, weekdoel gehaald |
| blij | iets gekregen of gekocht |
| sprongsquat | trainen in de sportschool |

- Aantallen frames en snelheden verschillen per persoon. Lees ze uit een manifest per persoon (`manifest.json`), nooit hardcoded. Gebruik de losse frames, niet de spritesheets: die hebben per persoon een andere indeling.
- Er is alleen een voor- en zijaanzicht. Naar links lopen = horizontaal spiegelen. Er is geen achteraanzicht nodig.
- Ankerpunt = midden onder de voeten, per animatie vastgezet, zodat poppetjes niet verspringen.
- Bij het laden: alle frames per persoon samenvoegen tot één atlas (webp) voor snelheid.
- Geen poppetje-editor. Iedereen heeft zijn eigen getekende poppetje.

## Zo ziet de wereld eruit

Kijk eerst naar de beelden in `docs/wereld/referentie/`. Dat is de lat.

| Bestand | Wat het is |
|---|---|
| `stijlvoorbeeld.png` | Bram op de bank in de woonkamer: zo horen poppetje en achtergrond samen te gaan, ook qua formaat |
| `buiten.png` | De straat met BADI-huis, Traffic Today, sportschool, park en buurttuin |
| `woonkamer.png` | Gedeelde woonkamer in het BADI-huis |
| `kantoor.png` | Traffic Today |
| `sportschool.png` | De sportschool |

De achtergronden zijn de echte achtergronden van de wereld, geen inspiratie. Gebruik ze als afbeelding en leg er een onzichtbaar loopgrid overheen.

Stijlregels:
- Getekend, met donkerbruine lijnen en zachte schaduw, net als de poppetjes.
- Warme kleuren: espresso, blush, salie, goud, crème.
- Binnenruimtes in schuin bovenaanzicht met twee achterwanden, voorkant open, deur in de linkermuur.
- Poppetjes zijn ongeveer even groot als een eettafelstoel hoog is (zie stijlvoorbeeld).
- Nooit platte vormen, blokjes of in code getekende gebouwen of poppetjes.

Wat er technisch bij hoort:
- Per achtergrond een loopgebied: tegels voor binnen, een getekende vorm voor buiten (buiten is niet zuiver isometrisch).
- Meubels waar je achter langs kunt lopen (bank, tafels, bureaus, loopbanden, bomen) worden als losse uitgeknipte laag bovenop het poppetje gelegd, anders loopt een poppetje er dwars doorheen.
- Nieuwe achtergronden of losse meubels maken we met Higgsfield, met deze beelden als stijlvoorbeeld.

## Wereld

- Buiten: straat, park met vijver en bankjes, buurttuin, kat.
- BADI-huis: per persoon een eigen kamer plus een gedeelde woonkamer.
- Traffic Today: kantoor met bureaus en vergadertafel.
- Sportschool: loopbanden, matten, bank.
- Tikken op een tegel = erheen lopen. Deur = andere ruimte. Stoel = zitten.

## Fases

### Fase 0: Fundament
Model: Opus 5.5

- Lees de hele codebase, inclusief de bestaande BADI Wereld, en beschrijf: framework, backend, auth, datamodel, hoe inchecken en trainingen nu worden opgeslagen, Winter Arc en Weekrad.
- Gebruik de bestaande plek van de wereld in de app; maak alleen een nieuwe route als die er nog niet is.
- Database: tabel voor wereldprofielen (user_id, uiterlijk van het poppetje, laatste ruimte en positie) met leesregels: iedereen in de groep leest, alleen jij schrijft je eigen rij.
- Klaar als: je opent de wereld vanuit de app, bent ingelogd als jezelf en ziet je naam.

### Fase 1: Wereld-engine
Model: Opus 5.5

- Breid de bestaande wereld uit met een tegelgrid, scènes, diepte en lopen, opgebouwd als losse modules (renderer, scènes, pathfinding, poppetjes, invoer). De bestaande look blijft.
- Poppetjes uit de sprites met de animaties hierboven, inclusief manifest en atlas.
- Soepel op telefoon (60 fps doel), slepen om rond te kijken, knijpen om te zoomen.
- Klaar als: je loopt overal soepel rond, alleen, op desktop en telefoon.

### Fase 2: Samen in de wereld
Model: Opus 5.5

- Realtime aanwezigheid per groep: wie is online, in welke ruimte, waar loopt hij heen.
- Alleen het doel delen; elke client rekent zelf de route uit.
- Openbare tekstballonnen per ruimte, niet opgeslagen.
- Wie offline is, staat op zijn laatste plek in een rustpose.
- Klaar als: twee telefoons zien elkaar lopen en praten.

### Fase 3: Privéchat
Model: Opus 5.5, daarna een controle in een nieuwe sessie, ook met Opus 5.5

- Tabellen: conversations (kind: 'dm' of 'room'), conversation_members (met last_read_at), messages.
- Row level security: alleen deelnemers lezen en schrijven, sender_id moet de eigen gebruiker zijn.
- Tik op poppetje: "Privé praten". Berichten als ballon met slotje, alleen voor de deelnemers.
- Berichten worden bewaard. Ongelezen = envelop boven het poppetje en in de eigen kamer, plus een pushmelding.
- Eigen kamer met deur dicht = gesprek van het type 'room' voor wie binnen is.
- Postvak met alle gesprekken en ongelezen aantallen.
- "Is aan het typen" via realtime presence, niet opgeslagen.
- Verplichte test: een derde account probeert berichten te lezen en te schrijven en dat mislukt.
- Klaar als: de test slaagt en wij vieren kunnen privé berichten sturen, ook als de ander offline is.

### Fase 4: Eigen kamer en munten
Model: Sonnet 5.5

- Eén munteenheid, alleen te verdienen met echte acties in Badi. Rustdagen tellen mee.
- Munten worden server-side toegekend, nooit door de client.
- Winkel met meubels en decoratie; inrichten door items op tegels te zetten.
- Bij elkaar op bezoek, ook als de ander offline is. High five of briefje achterlaten.
- Klaar als: een training in Badi zichtbaar iets oplevert in je kamer.

### Fase 5: Samen bouwen
Model: Sonnet 5.5

- Weekdoel voor de groep (bijvoorbeeld 12 trainingen samen). Gehaald = het dorp groeit.
- Een gemiste week maakt niets kapot.
- Winter Arc-mijlpalen leveren unieke items. Weekrad kan ook wereld-items geven.
- Samen trainen op dezelfde dag geeft een bonus.
- Klaar als: we samen iets hebben vrijgespeeld.

### Fase 6: Afwerking
Model: Sonnet 5.5, kleine aanpassingen met Haiku 5.5

- Extra animaties (bijvoorbeeld achteraanzicht, outfits) via nieuwe sprites, geluid, dag en nacht, seizoenen.

## Werkwijze per fase

Elke fase in een nieuwe sessie, met het model dat bij de fase staat. Loopt een fase vast op een lastig probleem, dan voor dat probleem Fable 5.2.


1. Lees eerst de code en dit document.
2. Maak een plan met de bestanden die je aanmaakt of wijzigt, en wacht op akkoord.
3. Bouw, test, en controleer op telefoonformaat.
4. Werk dit document bij: wat is gedaan, wat is anders gegaan, wat staat open.

## Voortgang

### Fase 0: Fundament (23-11-2026)

**Gedaan**
- Codebase beschreven: Next.js 16 (App Router, server actions), React 19, Tailwind 4, Motion. Supabase voor database (row level security), opslag en realtime. Inloggen met e-mailcode of wachtwoord; `requireContext()` geeft per pagina profiel, lidmaatschap en challenge. De groep is de challenge met `memberships`; leesregels via `is_member()` en `is_admin()`. Inchecken in `daily_checkins` (lijst `activities` per dag), trainingen in `workout_sessions` die via `checkin_sources` de check-in afvinken, stappen in `step_logs`. Winter Arc = de challenge met weekpunten, bonus, Super Badi en Wrapped. Weekrad = `prizes` en `wheel_spins`, één draai per week.
- Route `/wereld`, bereikbaar via het kaart-icoon in de kop (naast het Weekrad). Toont je naam, je poppetje, waar je bent en de squad.
- Tabel `world_profiles` (migratie 0030): `user_id`, `challenge_id`, `sprite`, `scene`, `x`, `y`, `updated_at`. De groep leest, alleen jij schrijft je eigen rij. Je profiel wordt bij je eerste bezoek aangemaakt.
- Poppetjes in `public/wereld/poppetjes/<naam>/`: losse frames van 320 x 272 en een `manifest.json` met per animatie de frames, de snelheid en het ankerpunt onder de voeten. Opnieuw maken met `npm run wereld:poppetjes`.
- Achtergronden in `public/wereld/scenes/` (buiten, woonkamer, kantoor, sportschool), de referentiebeelden en het stijlvoorbeeld in `docs/wereld/referentie/`.
- Het bestaande concept staat als `docs/wereld/concept.html`.
- Tests: wereldprofiel, en per poppetje dat alle acht animaties, alle frames en geldige ankerpunten er zijn.

**Anders gegaan**
- De BADI Wereld stond nog niet in de app: alleen als losse conceptpagina. Daarom is `/wereld` nieuw. Het concept is in code getekend (platte vormen); het telt alleen als basis voor de opzet (plekken, statussen, wie bij wie), niet voor het uiterlijk.
- "Uiterlijk van het poppetje" in het wereldprofiel is het veld `sprite` (welk getekend poppetje), omdat er geen editor komt.
- De atlas per poppetje wordt in fase 1 bij het laden gemaakt.

**Open**
- Migratie 0030 draaien in Supabase.
- Bram's `zitten` en `slapen` zitten in zijn eigen leunstoel (in het manifest gemarkeerd met `withChair`). Voor de bank en stoelen in de wereld is een losse zitpose nodig: 1 of 2 frames "Bram zittend, zonder stoel, transparant, 320 x 272".
- Eigen kamers per persoon: vier extra achtergronden nodig (fase 4).
- De kat staat niet in de buitenillustratie.

### Fase 1a: proef in de woonkamer (23-11-2026)

**Gedaan**
- Engine als losse modules in `src/lib/world/engine/`: `geometry`, `scene` (formaat van een ruimte), `grid` (tegelgrid over de getekende vloer, 24 x 24), `pathfinding` (A* in acht richtingen zonder hoeken af te snijden, daarna rechtgetrokken), `sprites` (manifest lezen, atlas bij het laden), `avatar` (lopen, zitten, kijkrichting, snelheid passend bij de loopanimatie), `depth` (welk meubel over wie getekend wordt), `renderer` (canvas, scherp op elk scherm, camera) en `input` (tikken, slepen, knijpen, scrollen).
- De woonkamer in `src/lib/world/scenes/woonkamer.ts`, opgemeten op de illustratie: vloer, loopgebied, meubels die vloer innemen, uitgeknipte lagen voor bank, salontafel, fauteuil, eettafel, plant op kruk en monstera, vier zitplekken (drie op de bank, de fauteuil) en de deur.
- Diepte: een poppetje achter een meubel krijgt dat stuk van de illustratie opnieuw over zich heen. Wie op de bank zit, zit voor de bank en achter de salontafel, zoals in het stijlvoorbeeld.
- `/wereld` toont de woonkamer: tik om te lopen, tik op de bank of stoel om te gaan zitten, tik op de deur om ernaartoe te lopen. Je plek wordt bewaard (`x`, `y` in pixels van de achtergrond).
- Controleweergave: `/wereld?debug=1` toont grid, loopvlak, uitgeknipte meubels (blauw), voorranden (oranje) en zitplekken. `?debug=2&als=anne` speelt als een ander poppetje en zet een testhaak `window.__wereld` aan.
- Getest in de demo op desktop en telefoonformaat: lopen om meubels heen, achter de eettafel langs, zitten op bank en fauteuil, opstaan, naar de deur. Tests voor grid, routes, diepte, frames en lopen.

**Anders gegaan**
- Posities worden bewaard als pixels in de achtergrond, niet als tegelnummer: dat werkt ook voor buiten, waar geen zuiver tegelgrid ligt.
- Zitten op de eettafelstoelen zit er nog niet in: je zou met je rug naar de kijker zitten en er is geen achteraanzicht.

**Open**
- ~~Bram kan nog niet zitten~~ Opgelost: losse zitpose `docs/wereld/bron/bram-zitten.png`, op de maat van het stijlvoorbeeld (204 px figuurhoogte in het frame).
- ~~De deur leidt nog nergens heen~~ Opgelost in fase 1b.
- Snelheid op een echte telefoon nog meten (doel 60 fps).

### Tussendoor: wereld alleen voor de beheerder (23-11-2026)

- Zolang `WORLD_OPEN` in `src/lib/world/types.ts` op `false` staat, ziet alleen de beheerder het kaart-icoon en `/wereld`. Voor de anderen geeft `/wereld` een 404 en wordt hun plek niet opgeslagen.
- Openzetten voor de squad: `WORLD_OPEN = true`, pushen.
- Lokaal bekijken zonder te pushen: `npm run dev` en dan http://localhost:3000/wereld (demo met `NEXT_PUBLIC_WINTER_ARC_DEMO=1`).

### Tussendoor: zitplekken plaatsen (23-11-2026)

Zitten op de bank was gokwerk: de zitplekken stonden met de hand in de code. Fase 1b ligt stil tot dit staat.

**Gedaan**
- Plaatsingsmodus op `/wereld?bewerken`, alleen voor de beheerder. Toont het loopgrid, de uitgeknipte meubels en alle zitplekken.
  - Tik op de zitting van een bank of stoel: daar komt een nieuwe zitplek, met de heupen op het punt waar je tikt (roze punt). De looptegel (groen punt) wordt de dichtstbijzijnde vrije tegel.
  - Sleep het roze punt om de heupen te verplaatsen, sleep het groene punt om de looptegel te kiezen (springt naar het midden van een vrije tegel). Slepen naast de punten kijkt rond, knijpen of scrollen zoomt.
  - Per zitplek: kijkrichting wisselen, "Probeer met je poppetje" (je loopt erheen en gaat zitten), verwijderen (knop of Delete-toets).
  - Opslaan schrijft `src/lib/world/scenes/<ruimte>.zitplekken.json` (route `src/app/api/wereld/zitplekken`, alleen bij `npm run dev` en voor de beheerder). Online kopieert de knop de JSON naar het klembord.
- Een zitplek is nu `{ id, hip, facing, approach }` in pixels van de achtergrond. Op welk meubel je zit, volgt uit het meubel waar de heupen in liggen.
- Per poppetje een `zitAnker` in het manifest (in `scripts/make-wereld-poppetjes.mjs`): het punt in het zit-frame waar de heupen zitten. Bij zitten komt dat punt precies op de zitplek, op dezelfde schaal als staan. Anne (158, 168), Daphne (155, 166), Irene (138, 168), Bram (147, 203).
- Getest op telefoonformaat: zitplek toevoegen, slepen, verwijderen, proberen, opslaan. Tests voor het inlezen van zitplekken, raken, het meubel onder een zitplek en het zitAnker.

**Open**
- ~~Voorgrondlaag voor arm- en rugleuningen~~ Gedaan: een meubel kan `foreground`-vlakken hebben (in de ruimte, bij het uitgeknipte meubel). Die worden uit de illustratie geknipt en over wie erop zit getekend. Woonkamer: beide armleuningen van de bank (links met het plaid) en de voorste armleuning van de fauteuil met de plant ervoor. In `?debug=1` paars gestippeld. De fauteuil-plek staat nu op de zitting (1400, 652), zodat je ín de stoel zit.
- ~~De vier zitplekken zijn nog schattingen~~ Opgelost: geplaatst en gecontroleerd door alle vier poppetjes op alle vier plekken te renderen met de rekenregels van de engine (`docs/wereld/zitplekken-controle.png`, rijen zit-1 t/m zit-4, kolommen Anne, Daphne, Irene, Bram). De middelste plek valt samen met Bram in het stijlvoorbeeld. De plaatsingsmodus is er voor correcties achteraf.
- zitAnker x is het midden van de romp: Anne 158, Daphne 155, Irene 138, Bram 147.

### Fase 1b: buiten, kantoor, sportschool en deuren (23-11-2026)

**Gedaan**
- Vier ruimtes, verbonden met deuren (`src/lib/world/scenes/index.ts`):
  - woonkamer: voordeur naar buiten;
  - buiten: voordeur van het huis, ingang Traffic Today, ingang sportschool;
  - kantoor: glazen deur naar buiten;
  - sportschool: deur naar buiten.
- Door een deur: het beeld vervaagt kort, je komt uit bij de bijbehorende deur aan de andere kant en die plek wordt bewaard. Alle achtergronden en je poppetje worden één keer geladen.
- Je start in de ruimte waar je het laatst was. Testen: `?debug=2&scene=kantoor` (of `&scene=` bij `?bewerken`) start direct in een ruimte.
- Raster per ruimte (`grid` in de ruimte):
  - de woonkamer houdt het schuine tegelgrid;
  - kantoor en sportschool zijn niet op één zuivere schuine lijn getekend en krijgen vakjes van 20 px binnen de getekende vloer;
  - buiten heeft vakjes van 10 px over het hele dorp. Gebouwen, vijver, moestuin, hagen, boomstammen, bankjes en lantaarnpalen zijn blokkades.
- De routezoeker gebruikt nu een heap: een route dwars door het dorp kost een paar milliseconden.
- Plekken (`spots`): je loopt erheen en doet daar iets.
  - Sportschool: rennen op beide loopbanden en sprongsquats op de drie matjes.
  - Zitten: op de halterbank.
- Kantoor:
  - zitten achter beide bureaus (vier stoelen) en aan de achterkant van de vergadertafel (twee stoelen), met het gezicht naar de kamer;
  - een zitplek kan aangeven op welk meubel je zit (`on`). Daardoor wordt het bureau voor je wel over je benen getekend.
- Buiten:
  - zitten op beide parkbankjes;
  - achter bomen en lantaarnpalen langs lopen.
- Poppetjes zijn buiten 112 px hoog (binnen 340). De looptempo schaalt mee en de camera start buiten dichterbij.
- fps-meter rechtsboven in `?debug=1`. Het controleraster wordt één keer vooraf getekend, zodat de meter de echte snelheid meet.
- Gecontroleerd:
  - per ruimte een render van raster, meubels, deuren en plekken;
  - Anne en Bram op elke zitplek en plek gerenderd;
  - in de app door alle deuren gelopen, gezeten, gerend en gesprongen, ook op telefoonformaat;
  - tests: elke deur leidt naar een ruimte met een deur terug, elke deur, zitplek en plek is bereikbaar, en een route door het dorp blijft snel.

**Anders gegaan**
- Kantoor en sportschool hebben geen schuin grid, maar vakjes binnen de vloer. De routes worden rechtgetrokken, dus je ziet het verschil niet.
- Geen koffieplek in het kantoor: alleen staan bij het apparaat voegt niets toe zolang er geen koffie-animatie is.

**Open**
- fps meten op een echte telefoon: open `/wereld?debug=1` en kijk rechtsboven, binnen en buiten.
- De kat staat niet in de illustratie en er is nog geen getekende kat.
- Zitten aan de voorkant van bureaus en tafels: daar zie je de rugleuning, en er is geen achteraanzicht van de poppetjes.

### Tussendoor: wereld schermvullend (23-11-2026)

- `/wereld` vult het hele scherm, zoals een game. Kop, tabbalk en Baddy's bubbel zijn daar weg (`isFullscreenPath` in `src/components/app/hide-on-chat.tsx`).
- Linksboven een terugknop naar de app en de naam van de ruimte. De plaatsingsmodus ligt als paneel onderin over de wereld.
- De camera zoomt nooit verder uit dan het punt waarop de illustratie het scherm vult, dus er zijn geen lege randen. Je start op die zoom en de camera volgt je poppetje; buiten start iets dichterbij (`startZoom`).
- De squadlijst onder de wereld is weg. Wie waar is, komt in fase 2 in de wereld zelf.
