# Stopwatchplus – stopur med skjult force

En PWA, der ligner stopuret i iPhonens **Ur**-app (iOS 26, mørk tilstand), og som i hemmelighed kan få tallet ved **Stop** (eller ved hver **Runde**) til at blive et tal, du har valgt på forhånd. Tilskueren starter og stopper selv. Ren vanilla JS, ingen afhængigheder, intet build-trin.

---

## 1. Opsætning

### Kør lokalt
```bash
npm run dev          # http://localhost:5173 (bruger npx serve)
npm test             # 28 tests, heraf 21.000 tilfældige tilskuere
npm run selftest     # kun den randomiserede selvtest (20.000 som standard)
python3 scripts/extract-icons.py   # lav app-ikonerne igen ud fra ref/ur-ikon.png
```

### Udgivelse (Vercel)
Repoet er et statisk site. Vercel-projektet er koblet til GitHub, så hvert push udgives automatisk:
- push til `main` → produktion
- push til andre branches → preview-link

Vercel-projekt: **stopwatchplus** (team *thyxo's projects*)
- Produktion (fra `main`): **https://stopwatchplus.vercel.app**
- Andre adresser (`stopwatchplus-git-…`, `stopwatchplus-<hash>-…`) kræver Vercel-login (standard-beskyttelse, samme som Calcplus).

Ingen build-kommando og ingen output-mappe (roden udgives som den er). `vercel.json` sørger for, at `sw.js` aldrig caches af CDN'et.

### Installér på iPhone
1. Åbn adressen i **Safari**.
2. Del-knappen → **Føj til hjemmeskærm** → navnet er allerede "Ur".
3. Åbn fra hjemmeskærmen: fuld skærm, ingen Safari-bjælker, virker offline.

> Tip: Læg ikonet i stedet for Apples Ur-app, og læg den rigtige i en mappe. Ikonet er skåret ud af et skærmbillede af din egen hjemmeskærm (mørkt Ur-ikon).

---

## 2. Sådan vælger du tilstand

**Hemmeligt panel:** tryk **5 gange hurtigt** (inden for 2½ sek.) i **øverste højre hjørne** (ved batteri-ikonet eller lige under). Panelet glider op. **Færdig** lukker det igen uden spor – stopuret står præcis, som det stod.

Øverst i panelet står planen, fx `Stop → ––.14,37` eller `Runder: 05 · 12 · 17 …`, og hvilken runde der er den næste.

| Tilstand | Hvad sker der | Eksempel |
|---|---|---|
| **Tid** (enkelt tid) | Tallet ved Stop. *Auto* vælger placering ud fra antal cifre: 1-2 cifre = hundrededele (`,37`), 3-4 = sekunder+hundrededele (`14,37`), 5-6 = hele visningen (`MM.SS,HH`). | `37` → `00.08,37` |
| **Række** (talrække) | Hver gang der trykkes **Runde**, fryser omgangen på næste tal i listen (hundrededelene). *Stop tager næste tal* = Stop fryser den sidste omgang på næste tal. *1 ciffer pr. runde* bruger kun sidste ciffer. | Lotto `5 12 17 23 28 31 36`, telefon `12345678` (4 runder à 2 cifre), PIN `2580` (1 ciffer pr. runde) |
| **Dato** | I morgen, i dag eller en fødselsdato (DDMMÅÅ). Placering: 3 runder (DD · MM · ÅÅ), `00.DD,MM` eller `DD.MM,ÅÅ`. | I morgen = 14-10-26 → runderne slutter på `14`, `10`, `26` |
| **Kode** (cifferkode) | Fx postnummer. `00.21,00` (sekunder+hundrededele), `21.00` (minutter+sekunder), `,HH` eller fordelt på runder. | `2100` → `00.21,00` |
| **Liste** | Én linje pr. tilskuer (bogtest: side linje ord, serienumre …). Linjen bruges på runder eller som ét tal ved Stop. *Næste linje efter Nulstil* går videre til næste linje, når en tilskuer er færdig. | `47 12 05` → runderne slutter på `47`, `12`, `05` |

Tal kan skilles med mellemrum, komma, punktum eller bindestreg (talfeltet på iPhone har komma). Lange tal deles i par: `12345678` → `12 34 56 78`.

### Øvrige indstillinger
| Indstilling | Betydning |
|---|---|
| **Force aktiv** | Slukket = helt almindeligt, korrekt stopur. |
| **Blind** | Tilskueren kigger ikke på skærmen i det øjeblik, de stopper ("hold telefonen væk og stop når du føler, der er gået 20 sekunder"). Så vises hele målet – også sekunder og minutter – uanset hvornår der stoppes. |
| **Tilladt synligt spring** | Hvor meget et aflæseligt ciffer (sekunder) må springe ved Stop. *Ingen* er standard og helt usynligt. |
| **Hvis målet ikke kan nås usynligt** | *Ram hundrededele*: ramte tilskueren ikke sekundet, passer i det mindste de to sidste cifre. *Vis ægte tid*: helt ærligt tal. |
| **Talrække ved Nulstil** | *Start forfra* (standard) eller *Fortsæt* med næste tal (fx Lotto fordelt på flere forsøg). |
| **Diskret prik** | En næsten usynlig mørkegrå prik øverst i midten, når force er klar. |
| **Seneste tryk** | Viser, hvad tilskueren *faktisk* stoppede på, og hvad der blev vist (✓ ramt, ½ kun hundrededele, – ærligt). En lokal "peek". |
| **Kør selvtest** | 2.000 tilfældige tilskuere direkte på telefonen. |

Indstillingerne gemmes på telefonen. Stopuret kører videre, selv om appen lukkes (som på iPhone).

---

## 3. Sådan virker force-motoren (den organiske metode)

- **Det viste tal følger ægte tid hele vejen.** Under kørslen er der ingen manipulation: tallet = ægte tid + en lille forskydning, der kun ændres i trykøjeblikket.
- **Kun de cifre, ingen kan nå at aflæse, ændres.** Mens uret kører, skifter hundrededele og tiendedele så hurtigt, at de ikke kan læses. Ved Stop fryser uret direkte på målet i *samme hele sekund*, som tilskueren så – fx `00.08,61` → `00.08,37`. Der springes aldrig til et sekund, de ikke så, medmindre sekundet alligevel skulle skifte inden for 0,25 sek. (eller netop er skiftet).
- **Runder:** Hvis målet er *kortere* end den ægte omgang, tælles resten med i næste omgang (totalen kører uændret videre). Er målet *længere*, springer totalen en brøkdel af et sekund frem – det ligner bare, at sekundet tikkede en anelse tidligt. Motoren vælger altid det mindst synlige.
- **Jævn tidsforvrængning bagefter:** Forskydningen glider derefter tilbage mod ægte tid med højst 2 % hastighedsændring (umærkeligt), så uret også passer, hvis nogen sammenligner med et andet ur.
- **Analog urskive:** Når urskiven er fremme, vægter motoren viserens ryk, og viseren glider kort (under 0,15 sek.) på plads ved Stop.
- **Alle tilfælde:** stop under 1 sek., over 10 min., over 1 time (`1.00.00,00`), flere stop/start i træk (hvert stop rammer igen), nulstilling midt i, appen lukket undervejs.

### Gode rutiner
- **Hundrededele** (`37`, Lotto, telefonnummer, PIN): virker altid, uanset hvornår der stoppes. Brug det, når tilskueren selv kigger.
- **Sekunder** (`14,37`, `00.21,00`): "Prøv at stoppe præcis på 14 sekunder" – rammer tilskueren inden for sekundet (eller ¼ sek. før), vises `14,37` (97,6 % i testen). Ellers vises kun `,37`.
- **Hele visningen / minutter** (`24.03,87`): brug **Blind**, eller lad uret køre længe nok.

---

## 4. Panik-knappen

**Hold fingeren i øverste venstre hjørne (ved klokken) i ca. 1 sekund.** Force slås øjeblikkeligt fra, og appen er et helt almindeligt, korrekt stopur. Der vises ingenting, og uret springer ikke. Der er også en rød **PANIK**-knap i panelet.

Start igen: panel → *Force aktiv*.

---

## 5. Fjernstyring og peek (idé – ikke bygget endnu)

**Fjernstyring:** Målet sendes live fra en anden telefon, også mens tilskueren holder stopuret.
- Lille Node-server (fx på Railway) med WebSocket (`ws`) eller Server-Sent Events, ét "rum" pr. optræden med en kort kode.
- Din telefon sender `{ "type": "target", "mode": "single", "value": "1437" }`; stopuret lytter og opdaterer `settings` (samme felter som panelet) – motoren læser planen ved hvert tryk, så et nyt mål virker med det samme, selv midt i en kørsel.
- Stopuret forbinder kun, hvis der er indtastet en rum-kode i panelet, og falder tilbage til panelets mål uden net.

**Peek:** Stopuret sender hvert tryk til din telefon: `{ "type": "peek", "kind": "stop", "natural": "00.14,05", "shown": "00.14,37", "result": "hit" }`. Data findes allerede (`engine.onLog` i `src/app.js` – det er det, panelets "Seneste tryk" viser), så det er kun forbindelsen, der mangler.

---

## 6. Kendte begrænsninger

- **Sekunder og minutter kan ikke tvinges usynligt**, hvis tilskueren kigger og stopper langt fra målet – så rammes kun hundrededelene (eller ægte tid). Brug *Blind* eller en rutine, hvor de sigter efter tallet.
- **Stop lige efter Runde i tilstanden Tid:** Hvis tilskueren trykker Runde og under et sekund efter Stop, kan målet i sjældne tilfælde ikke nås uden et synligt spring – så vises ægte tid (1 % i testen). Talrække-tilstandene har ikke det problem.
- **Omgangsrækken** kan i ca. 1 % af runderne skifte sit (lille) sekundtal ved frysning, for at totalen kan blive stående.
- Fanerne **Verdensur, Alarmer og Tidtagninger** er kun kulisser (enkle, iOS-agtige skærme). Kun stopuret virker.
- Skriften er San Francisco på iPhone. På Android/PC bruges systemets skrift; tallene skaleres til samme bredde, men ligner mindre.
- Ikke testet på en fysisk iPhone endnu – tjek især safe-area (notch/Dynamic Island/home-indikator), at 5-tryk øverst til højre registreres i hjemmeskærm-tilstand, og "Føj til hjemmeskærm".

---

## 7. Hvad er testet

`npm test` (Node 18+, ingen afhængigheder) – **28 tests, alle grønne**:

**Format:** `00.00,00`, `59.59,99`, `1.00.00,00` og `12.03.04,05` (timer uden foranstillet nul), afrunding af flydende tal.

**Mål:** auto-placering, talrækker med mellemrum/komma/lange tal, PIN med 1 ciffer pr. runde, i dag/i morgen (også nytårsaften → `010127`), fødselsdato, cifferkode som `00.21,00`/`21.00`/runder, ugyldige sekunder (`7500`) afvises, liste linje for linje, beskadigede indstillinger.

**Motor:** samme sekund ved hundrededele, SS,HH ram/delvis/ærlig, blind ved 0,3-61 sek., stop under 1 sek., efter 12 min. og efter 1 time, 6 stop/start i træk, talrække med Stop til sidst, kortere/længere omgang, nulstil midt i (forfra/fortsæt), panik midt i (intet spring), forskydningen glider tilbage og tallet går aldrig baglæns (4.000 frames), analog landing, gem/gendan mens uret kører.

**Randomiseret (21.000 tilskuere, seed 2026)** – tilfældige mål og stop-tidspunkter fra 0,05 sek. til 15 min., tilfældige omgange (også hurtigt efter hinanden), flere stop/start, nulstilling midt i, digital/analog:

```
Hundrededele, stop når som helst ....... ramt 99,0 %   (resten: ægte tid, se begrænsninger)
SS,HH – tilskueren sigter efter sekundet  første stop ramt 97,6 %  (resten: kun hundrededele)
SS,HH – helt tilfældigt stop (0-60 s) ... ramt 2,5 %, kun hundrededele 97,3 %
Blind: hele målet ...................... ramt 100,0 %
Talrække på runder (Lotto, tlf., PIN) .. ramt 100,0 %  (13.677 runder)
I morgens dato på 3 runder ............. ramt 100,0 %
Ærlig tilstand (force slået fra) ....... 7.666 tryk, 0 afvigelser

Synlige spring (aflæseligt ciffer ændret): 0
Tal der gik baglæns: 0 · negative omgange: 0 · sum-fejl: 0 · forkert vist: 0
Største viser-ryk ved stop (analog): 6,5° (glider på plads på <0,15 sek.)
```

Testet i headless Chromium (393×852, iPhone-mål, Inter som erstatning for San Francisco): layout lagt oven på dine skærmbilleder side om side, hemmelig gestus, panel, talrække, panik, faner, visning over 1 time.

---

## Filer
```
index.html            markup (stopur, faner, kulisse-skærme, hemmeligt panel)
styles.css            udseende – mål taget fra skærmbillederne (ref/)
src/format.js         dansk stopur-format
src/engine.js         stopur + force-motor (ingen DOM, testbar)
src/targets.js        tilstande → plan (mønstre for Stop og runder)
src/settings.js       indstillinger (localStorage)
src/dial.js           analog urskive (SVG)
src/selftest.js       randomiseret selvtest (Node + i appen)
src/app.js            UI, gestusser, panel, service worker
sw.js                 offline-cache (hæv VERSION ved ændringer)
ref/                  dine skærmbilleder + ur-ikon.png
scripts/              ikon-script og selvtest-CLI
tests/                node:test
```
