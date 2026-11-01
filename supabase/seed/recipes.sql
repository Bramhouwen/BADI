-- Vijf startrecepten voor de Winter Arc, geplaatst namens de beheerder van de challenge.
-- Uitvoeren in de Supabase SQL Editor (nieuw tabblad). Veilig om één keer te draaien.
-- Foto's zijn AI-gegenereerde beelden uit de app zelf (static:/recipes/...); vervangen kan via "Recept bewerken".

with c as (
  select id as challenge_id, created_by as user_id from public.challenges order by created_at limit 1
)
insert into public.recipes (challenge_id, user_id, title, description, ingredients, instructions, category, protein_grams, image_path)
select c.challenge_id, c.user_id, r.title, r.description, r.ingredients, r.instructions, r.category, r.protein_grams, r.image_path
from c
cross join (values
  (
    'Overnight oats met skyr en blauwe bessen',
    'Vijf minuten werk de avond ervoor, klaar als je wakker wordt. Veel eiwit, langzame koolhydraten en geen suikerdip.',
    E'60 g havermout\n150 g skyr naturel\n150 ml halfvolle melk\n1 el chiazaad\n75 g blauwe bessen\n1 tl kaneel\nSnuf zout',
    E'Roer havermout, skyr, melk, chiazaad, kaneel en zout door elkaar in een pot.\nZet afgedekt minimaal 6 uur in de koelkast.\nTop in de ochtend af met de blauwe bessen. Wil je zoeter: een theelepel honing.',
    'Ontbijt', 28, 'static:/recipes/overnight-oats.jpg'
  ),
  (
    'Volkoren wrap met kip, hummus en spinazie',
    'Snelle lunch die je ook mee kunt nemen. Kip van gisteren of kant-en-klare gegrilde kipfilet werkt prima.',
    E'1 grote volkoren wrap\n120 g gegrilde kipfilet\n2 el hummus\n1 handvol babyspinazie\n1/4 komkommer, in reepjes\n1/4 rode paprika, in reepjes\nPeper, paprikapoeder, citroensap',
    E'Besmeer de wrap met hummus.\nVerdeel spinazie, kip, komkommer en paprika over de wrap.\nKruid met peper, paprikapoeder en wat citroensap. Oprollen, halveren, klaar.',
    'Middageten', 38, 'static:/recipes/kip-wrap.jpg'
  ),
  (
    'Zalm uit de oven met zoete aardappel en broccoli',
    'Eén bakplaat, nauwelijks afwas. Omega-3 van de zalm, vezels van de zoete aardappel en veel groente.',
    E'150 g zalmfilet\n250 g zoete aardappel, in blokjes\n250 g broccoli, in roosjes\n1 el olijfolie\n1 teen knoflook, fijngehakt\n1/2 citroen\nZout, peper, chilivlokken',
    E'Verwarm de oven voor op 200 graden.\nHussel zoete aardappel met de helft van de olie, zout en peper. Bak 15 minuten.\nVoeg broccoli, knoflook en zalm toe, besprenkel met de rest van de olie en bak nog 12 tot 15 minuten.\nServeer met citroensap en chilivlokken.',
    'Avondeten', 40, 'static:/recipes/zalm-zoete-aardappel.jpg'
  ),
  (
    'Kip-teriyaki bowl met rijst en edamame',
    'Ideaal voor meal prep: maak drie porties en je bent de rest van de week klaar. Sojasaus in plaats van kant-en-klare teriyaki houdt de suiker laag.',
    E'150 g kipdijfilet, in blokjes\n75 g (ongekookte) zilvervliesrijst\n100 g edamame\n1 wortel, in reepjes\n2 el sojasaus (minder zout)\n1 tl honing\n1 tl geraspte gember\n1 teen knoflook\nSesamzaad, lente-ui',
    E'Kook de rijst volgens de verpakking.\nBak de kip in een hete pan goudbruin. Voeg knoflook, gember, sojasaus en honing toe en laat 2 minuten inkoken.\nKook de edamame 3 minuten.\nSchep rijst, kip, edamame en wortel in een kom. Werk af met sesamzaad en lente-ui.',
    'Avondeten', 45, 'static:/recipes/kip-teriyaki-bowl.jpg'
  ),
  (
    'Kwark met banaan, walnoten en kaneel',
    'Het tussendoortje dat altijd werkt: twee minuten, verzadigend en goed voor je eiwitinname op een trainingsdag.',
    E'250 g magere kwark\n1/2 banaan, in plakjes\n15 g walnoten\n1 tl kaneel\nOptioneel: 1 tl honing',
    E'Schep de kwark in een kom, leg de banaan erop, strooi de walnoten en kaneel eroverheen.\nEet het meteen, of neem het mee in een potje.',
    'Tussendoortje', 24, 'static:/recipes/kwark-walnoot.jpg'
  )
) as r(title, description, ingredients, instructions, category, protein_grams, image_path)
where not exists (select 1 from public.recipes x where x.title = r.title and x.challenge_id = c.challenge_id);
