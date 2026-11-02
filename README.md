# BADI ❄️

BADI (Run Squat) is een private, installeerbare web-app (PWA) voor precies vier vrienden die tijdens hun Winter Arc, van 1 november t/m 31 december 2026 samen gezonde gewoontes opbouwen.

Geen ranking, geen verliezer, geen druk. Wel: een check-in van tien seconden, persoonlijke streaks, een gedeelde keuken met recepten, een intieme fotomuur, complimenten en aan het eind een Winter Arc Wrapped.

## Stack

| Laag | Keuze |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Turbopack) + TypeScript |
| Styling | Tailwind CSS v4, eigen design tokens, Geist |
| Motion | `motion` (Framer Motion), met respect voor `prefers-reduced-motion` |
| Icons | Lucide |
| Backend | Supabase: Auth, Postgres (RLS), Storage (private buckets), Realtime |
| Tests | Vitest |
| PWA | Web App Manifest, service worker, iOS safe areas |

## Structuur

```
src/
  app/
    (auth)/login           inloggen (magic link, wachtwoord, account aanmaken)
    (app)/                 ingelogde schermen met header en bottom navigation
      page.tsx             Home
      checkin/             Daily check-in
      kitchen/             Winter Arc Kitchen (lijst, detail, nieuw, bewerken)
      wall/                The Wall (feed, detail, nieuw)
      water/               Waterteller per dag met zevendaags overzicht
      fitness/             Fitness Tracker: dashboard, starten, krachtlogger, schema's, geschiedenis, progressie
      squad/               Squad, complimenten, inbox
      profile/             Profiel, uitnodigen, zeven principes
      notifications/       Meldingen
      wrapped/             Winter Arc Wrapped
    actions/               Server Actions (alle writes, met zod-validatie)
    auth/callback          magic link / e-mailbevestiging
    invite/[token]         uitnodiging accepteren
    onboarding/            eerste keer: squad starten of uitnodiging gebruiken
    manifest.ts            PWA manifest
  components/              UI en app-componenten
  lib/
    dates.ts               alle datum- en tijdzonelogica (Europe/Amsterdam)
    streaks.ts             streakberekening (server-side, uit check-in datums)
    wrapped.ts             Wrapped-statistieken
    data.ts                data access layer (profiel, lidmaatschap, challenge)
    storage.ts             signed URLs voor private foto's
    supabase/              clients voor browser, server en proxy
  proxy.ts                 sessie verversen en private routes beschermen
supabase/migrations/       database schema, triggers, RLS, storage policies, RPC's
tests/                     unit tests voor de kritieke logica
scripts/generate-icons.mjs genereert de app-icons
public/sw.js               service worker
```

## Lokaal draaien

Vereisten: Node 22+, npm, een Supabase-project (gratis tier is genoeg).

1. Installeer dependencies:

   ```bash
   npm install
   ```

2. Maak een Supabase-project op https://supabase.com en voer de migratie uit:
   - Open **SQL Editor** in het Supabase dashboard.
   - Plak de inhoud van `supabase/migrations/0001_winter_arc_schema.sql` en voer uit.
   - Voer daarna ook `0002_fix_pgcrypto_search_path.sql` (nodig op Supabase, waar pgcrypto in het schema `extensions` staat), `0003_water_entries.sql` (waterteller), `0004_fitness_tracker.sql` (Fitness Tracker) en `0005_squad_stats.sql` (Squad-statistieken en deelinstellingen) `0006_squad_chat.sql` (Squad-chat) `0007_chat_attachments.sql` (bijlagen in de chat) `0008_chat_mentions.sql` (@-tags) `0009_recipes_optional_fields.sql` (foto optioneel bij recepten) `0010_baddy_coach.sql` (Baddy de Coach) `0011_baddy_memory_feedback.sql` (geheugen en feedback voor Baddy) `0012_checkin_plan_joker_push.sql` (dagelijkse check, weekplanning, jokers en pushmeldingen), `0013_water_bottles_coach_push.sql` (eigen waterflessen, Baddy-meldingen) en `0014_coach_push_schedule.sql` (planning van Baddy om 7:00 en 21:00) uit, in die volgorde.
   - Heb je de Supabase CLI: `supabase link --project-ref <ref>` en daarna `supabase db push`.

   De migratie maakt alle tabellen, triggers (edit-venster, maximaal vier leden, rate limiting), RLS-policies, de private storage buckets (`wall`, `recipes`, `avatars`) met policies en de RPC's voor uitnodigingen.

3. Auth-instellingen in Supabase (**Authentication > URL Configuration**):
   - Site URL: `http://localhost:3000` (lokaal) of je productie-URL.
   - Redirect URLs: voeg `http://localhost:3000/auth/callback` en `https://<jouw-domein>/auth/callback` toe.
   - Onder **Authentication > Providers > Email**: laat "Confirm email" aan. Magic links en wachtwoordlogin werken allebei.
   - Optioneel: pas de e-mailtemplates aan. De magic-link-template moet `{{ .ConfirmationURL }}` bevatten (standaard).

4. Maak `.env.local` op basis van `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

   Vul `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_ANON_KEY` in (Project Settings > API). Zet `NEXT_PUBLIC_SITE_URL` op `http://localhost:3000`.

   De service-role key is nergens nodig en hoort nooit in de browser.

5. Start de dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Demo-modus (zonder Supabase)

Wil je de app eerst alleen bekijken? Zet in `.env.local`:

```
NEXT_PUBLIC_WINTER_ARC_DEMO=1
```

De app draait dan op een in-memory backend met voorbeelddata: vier leden, check-ins, recepten, foto's, complimenten en meldingen. Je bent automatisch ingelogd als "Bram" (beheerder). Alles wat je doet (inchecken, reageren, een recept toevoegen) werkt, maar verdwijnt zodra de dev server herstart. Foto-uploads tonen een placeholder. Zet de variabele op `0` of verwijder hem zodra je Supabase hebt gekoppeld. De demo-code staat in `src/lib/demo/` en wordt buiten demo-modus niet gebruikt.

## Eerste gebruik: de squad opzetten

1. De eerste persoon maakt een account (tab **Account** op de loginpagina) of logt in met een magic link.
2. Na het inloggen kom je op **Welkom**: kies **Maak de squad aan**. Je wordt beheerder van "Winter Arc 2026" (1 november t/m 31 december 2026).
3. Ga naar **Profiel > Squad uitnodigen** en maak een uitnodigingslink. Links zijn eenmalig, zeven dagen geldig en optioneel gebonden aan een e-mailadres. Deel ze via WhatsApp of de deelknop.
4. Elke vriend opent de link, maakt een account of logt in, en tikt **Ik doe mee**. Na vier leden is de groep vol: de database weigert een vijfde lid.

## Startrecepten

Wil je de Kitchen gevuld starten? Voer `supabase/seed/recipes.sql` uit in de SQL Editor. Dat plaatst vijf recepten (ontbijt, middageten, avondeten en een tussendoortje) namens de beheerder, met AI-gegenereerde foto's uit `public/recipes/` (originelen in `assets/recipes/`). Vervangen kan altijd via "Recept bewerken".

## Scripts

| Commando | Doel |
| --- | --- |
| `npm run dev` | ontwikkelserver |
| `npm run build` | productiebuild |
| `npm start` | productieserver |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run icons` | app-icons opnieuw genereren |

## Belangrijke regels in de logica

- **Eén check-in per dag** per lid, ongeacht het aantal activiteiten (unieke constraint in de database).
- **Edit-venster**: vandaag en gisteren zijn aanpasbaar tot 23:59 vandaag, in Europe/Amsterdam. Een database-trigger weigert alles daarbuiten, ook via de API.
- **Streaks** worden server-side berekend uit check-in datums (`src/lib/streaks.ts`). Een nog niet ingecheckte "vandaag" breekt de streak niet.
- **Buiten de challenge** kun je alles teruglezen, maar geen nieuwe challenge-dagen verdienen.
- **Privacy**: alle data is alleen leesbaar voor leden van dezelfde squad (RLS). Foto's staan in private buckets en worden via signed URLs (1 uur geldig) geserveerd. Complimenten zijn alleen zichtbaar voor zender en ontvanger. Alcohol-uitzonderingen zijn strikt privé.
- **Geen ranking**: squad-kaarten roteren per dag en worden nooit op streak gesorteerd. Wrapped kent geen winnaar.
- **Fitness en check-in**: een voltooide training ondersteunt automatisch Bewogen (cardio, HIIT, yoga, overig) of Krachttraining plus Bewogen (kracht) op die dag. Handmatige vinkjes en trainingen zijn aparte bronnen in `checkin_sources`; de dagstatus is de vereniging daarvan, dus een categorie telt nooit dubbel en een handmatig vinkje verdwijnt nooit door het verwijderen van een training. Trainingen buiten het correctievenster (vandaag of gisteren) worden bewaard, maar kunnen geen check-in meer veranderen.

## Tests

```bash
npm test
```

Dekt: tijdzonegrenzen, challenge-start en -einde, het correctievenster, streaks (inclusief dubbele datums en maandgrenzen), Wrapped-berekeningen, foto-pad-autorisatie en foutmeldingen. Autorisatie op rijniveau (RLS), het vier-ledenlimiet, duplicaten en rate limiting worden afgedwongen in de database (`supabase/migrations/0001_winter_arc_schema.sql`).

Handmatig te testen op mobiel: layouts op 320, 375, 390 en 430 px breed, formulieren met open toetsenbord (de bottom navigation verbergt zich automatisch zodra een tekstveld focus heeft) en de PWA-installatie.

## Deployen en installeren op vier telefoons

Zie [DEPLOYMENT.md](DEPLOYMENT.md).
