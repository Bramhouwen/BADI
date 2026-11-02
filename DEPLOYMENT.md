# Deployen en installeren

## 1. Supabase (productie)

1. Maak een Supabase-project (regio bij voorkeur `eu-central-1`, Frankfurt).
2. Voer de migraties uit in de SQL Editor, in volgorde: `0001_winter_arc_schema.sql`, `0002_fix_pgcrypto_search_path.sql`, `0003_water_entries.sql`, `0004_fitness_tracker.sql`, `0005_squad_stats.sql`, `0006_squad_chat.sql`, `0007_chat_attachments.sql`, `0008_chat_mentions.sql`, `0009_recipes_optional_fields.sql`, `0010_baddy_coach.sql`, `0011_baddy_memory_feedback.sql`, `0012_checkin_plan_joker_push.sql`, `0013_water_bottles_coach_push.sql`, `0014_coach_push_schedule.sql`, `0015_custom_habits.sql`, `0016_direct_messages_reactions.sql`, `0017_recipe_ai_images.sql` (of `supabase db push` met de CLI).
3. **Authentication > URL Configuration**:
   - Site URL: `https://<jouw-domein>`
   - Redirect URLs: `https://<jouw-domein>/auth/callback`
4. **Authentication > Providers > Email**: Email aan, "Confirm email" aan.
5. Optioneel maar aan te raden na het compleet maken van de squad: zet **Allow new users to sign up** uit (Authentication > Sign In / Up). Dan kan niemand meer een account aanmaken, ook niet buiten de groep om.
6. **E-mail**: de ingebouwde mailserver van Supabase is alleen voor testen (paar mails per uur, komt niet altijd aan). Koppel voor magic links en bevestigingsmails een eigen SMTP-dienst onder Project Settings > Authentication > SMTP Settings, bijvoorbeeld Resend (gratis tier). Zonder eigen SMTP: zet "Confirm email" uit en laat vrienden inloggen met een wachtwoord.
6. Controleer onder **Storage** dat de buckets `wall`, `recipes` en `avatars` bestaan en **private** zijn.
7. Controleer onder **Database > Replication** (of Realtime) dat de tabellen `wall_posts`, `post_reactions`, `recipe_reactions`, `compliments`, `recipes`, `daily_checkins` en `notifications` in de `supabase_realtime` publicatie zitten. De migratie regelt dit, maar het is goed om te verifiëren.

Verlopen uitnodigingen opruimen kan met een simpele query of via de beheerderspagina in de app (intrekken).

## 2. Vercel

1. Zet de code in een Git-repository (GitHub, GitLab of Bitbucket) en importeer het project in Vercel. Framework preset: Next.js.
2. Environment variables (Production en Preview):

   | Naam | Waarde |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon (of publishable) key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<jouw-domein>` |

3. Deploy. Met de Vercel CLI: `npm i -g vercel`, daarna `vercel` (preview) of `vercel --prod`.
4. Koppel eventueel een eigen domein. Werk daarna de Site URL en Redirect URLs in Supabase bij.

De app gebruikt de standaard Node.js runtime (Fluid Compute); er is geen extra configuratie nodig.

### Andere hosting

Elke host die Next.js 16 ondersteunt werkt. Zet dezelfde drie environment variables en draai `npm run build` gevolgd door `npm start`.

## 3. Installeren op de vier telefoons

De app is een PWA: geen App Store, geen TestFlight.

**iPhone (Safari)**

1. Open `https://<jouw-domein>` in Safari (niet in de WhatsApp- of Instagram-browser).
2. Tik op het deel-icoon (vierkant met pijl omhoog).
3. Kies **Zet op beginscherm** en bevestig.
4. Open Winter Arc vanaf het beginscherm. De app draait dan in standalone-modus met het sneeuwvlok-icoon en zonder adresbalk.

Tip: log eerst in via Safari, zodat de sessie wordt overgenomen door de geïnstalleerde app. Magic links openen altijd in Safari; na het klikken ben je ook in de geïnstalleerde app ingelogd (zelfde cookies op hetzelfde domein).

**Android (Chrome)**

1. Open de URL in Chrome.
2. Tik op het menu (drie puntjes) en kies **App installeren** of **Toevoegen aan startscherm**. Chrome toont soms zelf een installatiebanner.
3. Open de app vanaf het startscherm.

**Camera en foto's**

De foto-knop gebruikt de native fotokiezer van het toestel. Op iPhone kun je kiezen tussen Fotobibliotheek, Foto maken en Bestanden. Foto's worden op het toestel gecomprimeerd (max. 1600 px, JPEG) voordat ze naar de private bucket gaan.

**Meldingen**

Meldingen zijn in-app (het belletje rechtsboven). Push-notificaties zijn bewust niet vereist; de app werkt volledig zonder toestemming voor push.

## 4. Onderhoud tijdens de challenge

- **Nieuw lid toevoegen**: beheerder maakt een link onder Profiel > Squad uitnodigen. Max. vier leden.
- **Lid verwijderen**: verwijder de rij in `memberships` via het Supabase dashboard (en eventueel de gebruiker onder Authentication). Check-ins, posts en recepten van dat lid verdwijnen mee (cascade).
- **Datums aanpassen**: wijzig `start_date` en `end_date` in de tabel `challenges`. Het edit-venster en Wrapped volgen automatisch.
- **Wrapped**: op 31 december verschijnt de voorlopige versie. Vanaf 2 januari (na het sluiten van het correctievenster voor 31 december) is de Wrapped definitief.

## 5. Beveiliging in het kort

- Alleen de anon key staat in de browser. Alle rechten lopen via Row Level Security en SECURITY DEFINER-functies met expliciete controles.
- Leden zien uitsluitend data van hun eigen squad. Alleen de eigenaar kan check-ins, recepten, posts en profiel wijzigen.
- Foto's staan in private buckets met per-map policies; de app serveert ze met signed URLs van een uur.
- Uitnodigingstokens worden gehasht opgeslagen (SHA-256), zijn eenmalig en verlopen na zeven dagen.
- De service worker cachet alleen statische bestanden en de offline-pagina, nooit persoonlijke data.

## Baddy de Coach

1. Maak een API-sleutel aan op console.anthropic.com en zet een tegoed of betaalmethode klaar.
2. Voeg in Vercel onder Settings, Environment Variables `ANTHROPIC_API_KEY` toe voor Production (en Preview als je wilt), zonder `NEXT_PUBLIC_`.
3. Redeploy. Zonder sleutel toont Baddy een melding dat ze nog niet gekoppeld is.

Baddy gebruikt `claude-opus-5-5`. Per lid geldt een limiet van 40 vragen per dag en in de squadchat 15 antwoorden per dag, om kosten te begrenzen.

## Pushmeldingen

1. Maak sleutels met `npx web-push generate-vapid-keys` (of gebruik die uit `.env.local`).
2. Zet in Vercel `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` en `VAPID_SUBJECT` (bijvoorbeeld `https://badi-mu.vercel.app`) voor Production.
3. Redeploy: de publieke sleutel wordt in de build meegenomen.
4. Leden zetten meldingen per apparaat aan via Profiel, Meldingen. Op iPhone werkt dit alleen vanaf het beginscherm-icoon (iOS 16.4 of nieuwer).
