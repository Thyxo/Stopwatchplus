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

## 2. Panelet

**Åbn:** tryk **5 gange hurtigt** (inden for 2½ sek.) i **øverste højre hjørne**. **Færdig** lukker uden spor (tryk på Færdig det første sekund ignoreres, så et ekstra tryk ikke lukker panelet). Appen starter på **Tom rutine** (ingen force), indtil du vælger noget.

Øverst: planen (fx `K♦ er nr. 26 → Stop ––.––,26`), kontakten **Force aktiv** og hvad tilskueren sidst *faktisk* stoppede på. Derunder tre faner:

### Indstil (åbner altid her)
Viser hvilken rutine du redigerer. **Alt du ændrer her, gemmes i den valgte rutine.**

| Tilstand | Hvad sker der | Eksempel |
|---|---|---|
| **Tid** | Tallet ved Stop. *Auto*: 1-2 cifre = `,HH`, 3-4 = `SS,HH`, 5-6 = `MM.SS,HH`. | `37` → `00.08,37` |
| **Række** | Hver **Runde** fryser på næste tal. *Stop tager næste tal*. 1 eller 2 cifre pr. runde. | Lotto, telefonnummer, PIN |
| **Dato** | I morgen, i dag, fødselsdato (DDMMÅÅ) eller **klokken nu** (+ minutter). På runder, `00.DD,MM` eller `DD.MM,ÅÅ`. | 14 · 10 · 26 |
| **Kode** | Fx postnummer: `00.21,00`, `21.00`, `,HH` eller runder. | `2100` |
| **Kort** (ACAAN) | Kortets plads i en stak (Mnemonica, Aronson, Si Stebbins eller din egen) vises ved Stop – som hundrededele eller sekunder. Ekstra kort ovenpå og "tæl fra bunden". | K♦ i Mnemonica → `00.07,26` |
| **Liste** | Én linje pr. tilskuer (bogtest, serienumre). Går videre til næste linje efter Nulstil. | `47 12 05` |

**Aktivering**
| Indstilling | Betydning |
|---|---|
| **Force først efter** 1/3/5/10 s | Stop eller runder før tiden er helt ærlige (og bruger ikke tal fra talrækken). Godt mod "jeg trykkede ved et uheld". |
| **Ærlige forsøg først** 1-3 | De første forsøg (Start → Nulstil) er ægte. Tælles fra du lukker panelet. "Prøv lige uret først" → næste forsøg rammer. |
| **Kun én gang** | Efter et forsøg med force slås force fra, når der trykkes Nulstil. Bagefter kan alle undersøge appen. |

### Rutiner
14 færdige rutiner, **hver med sine egne tal**: To sidste cifre · Ærlig prøve først · Ram sekundet · Blind stop · ACAAN · Lotto-række · Telefonnummer · PIN-kode · I morgens dato · Klokken lige nu · Fødselsdag · Fødselsår · Postnummer · Bogtest.

- Tryk for at vælge; feltet til dit tal (eller kortvælgeren) vises under rutinen.
- **Rediger** (øverst til højre): flyt ↑↓, **Rediger** (åbner rutinen i Indstil), **Omdøb**, **Kopi**, **Slet**.
- **+ Ny rutine ud fra nuværende** og **Læg slettede standardrutiner tilbage**.

### Mere
Blind, diskret prik, hold-peek til/fra, tilladt synligt spring, hvad der sker hvis målet ikke kan nås, talrække ved Nulstil, log over seneste tryk, selvtest og PANIK.

---

## 2b. ACAAN med perform mode (falsk hjemmeskærm)

**Start:** panel → Indstil → **Perform – vis hjemmeskærm** (eller slå *Start på hjemmeskærm* til under Mere, så åbner appen altid der). Skærmen er dine egne skærmbilleder af hjemmeskærmen – den rigtige statuslinje ligger ovenpå.

1. Stak bunken og vælg rutinen **ACAAN** (og stakken under Indstil → Kort).
2. Tilskueren nævner et kort.
3. **Side 1 → 2: værdien.** Start swipet på værdiens ikon:

   | Værdi | Ikon (række, kolonne) |
   |---|---|
   | 1 (es) | Påmindelser (række 2, kolonne 4) |
   | 2 · 3 · 4 | Vejr · Duolingo · Apple TV (række 3) |
   | 5 · 6 · 7 | Snapchat · Kort · Watch (række 4) |
   | 8 · 9 · 10 | Sundhed · Kalender · Spotify-ikonet (række 5) |
   | 11 · 12 · 13 (J Q K) | Discord · AirPods · YouTube (række 6) |

4. **Side 2 → 3: kuløren** (CHSD). Start swipet et vilkårligt sted i rækken: **række 3 = ♣**, **række 4 = ♥**, **række 5 = ♠**, **række 6 = ♦**.
5. **Tryk på Ur** (side 3) – stopuret åbner ud af ikonet med kortet valgt. Tilskueren starter og stopper; hundrededelene viser kortets plads.

Swiper du forkert, så swipe tilbage og om igen – det sidste swipe tæller. Mangler værdi eller kulør, beholdes den del fra det kort, der var valgt før. Panelets log viser "Kort valgt på hjemmeskærmen: 7♥".

**Reserve:** fanen **Tidtagninger** – timer = kulør (1 ♣, 2 ♥, 3 ♠, 4 ♦), min. = værdi (1-13). Eller vælg kortet i panelet.

> Tag nye skærmbilleder, hvis din hjemmeskærm ændrer sig (notifikationstal, nye apps), og læg dem i `home/` (se `src/home.js` for mål).

---

## 2c. Peek – se hvad de stoppede på

| Metode | Sådan |
|---|---|
| **Hold-peek** (bygget) | Tilskueren stopper hemmeligt, trykker **Nulstil** og giver dig telefonen. **Hold fingeren på tallet i ½ sek.** – det sidste stop og alle runder vises, så længe du holder. Slip → 00.00,00 igen. |
| **Log** (bygget) | Panelets top og **Mere → Seneste tryk** viser ægte og vist tal for hvert tryk. |

**Idéer til flere peeks (ikke bygget endnu):**
- **Gummibånd-peek:** træk den digitale side mod højre – i "hullet" ved kanten står det sidste stop med mørkegrå skrift (som tidsstemplet i Noter-appen).
- **Verdensur-peek:** en ekstra by i Verdensur, hvis klokkeslæt er sekunderne og hundrededelene fra sidste stop (fx "Reykjavik 14.37").
- **Analog-peek:** efter Nulstil står den blå omgangsviser stille på sidste stops sekund – kun du ved, hvad den betyder.
- **Fjern-peek:** stoppet sendes til din egen telefon/Apple Watch via en lille server (WebSocket). Data findes allerede (`engine.onLog`).
- **Matematisk peek:** tilskueren lægger tallet til fx deres alder – appen kender begge dele og viser resultatet som "tilfældigt" tal i næste forsøg.

---

## 2d. Flere idéer til rutiner
- **Dobbelt-forudsigelse:** to tilskuere stopper hver sit ur (Runde/Stop); summen af deres to tal = dit tal (motoren kan beregne det andet tal ud fra det første).
- **Lotto i flere forsøg:** "Fortsæt" ved Nulstil – én tilskuer pr. tal.
- **Klokken lige nu:** "Hvornår mødes vi i morgen?" → runderne viser tidspunktet, du har skrevet på en seddel.
- **Fødselsår + alder:** Runde viser 19 · 87; næste forsøg viser deres alder.
- **Kortspil uden stak:** to omgange = værdi (01-13) og kulør (1-4).
- **Postkort/hotelværelse:** værelsesnummer (3-4 cifre) som SS,HH med "stop på 20 sekunder".

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

## 5. Fjernstyring (idé – ikke bygget endnu)

**Fjernstyring:** Målet sendes live fra en anden telefon, også mens tilskueren holder stopuret.
- Lille Node-server (fx på Railway) med WebSocket (`ws`) eller Server-Sent Events, ét "rum" pr. optræden med en kort kode.
- Din telefon sender `{ "type": "target", "mode": "single", "value": "1437" }`; stopuret lytter og opdaterer `settings` (samme felter som panelet) – motoren læser planen ved hvert tryk, så et nyt mål virker med det samme, selv midt i en kørsel.
- Stopuret forbinder kun, hvis der er indtastet en rum-kode i panelet, og falder tilbage til panelets mål uden net.

**Peek:** Stopuret sender hvert tryk til din telefon: `{ "type": "peek", "kind": "stop", "natural": "00.14,05", "shown": "00.14,37", "result": "hit" }`. Data findes allerede (`engine.onLog` i `src/app.js` – det er det, panelets "Seneste tryk" viser), så det er kun forbindelsen, der mangler.

---

## 6. Kendte begrænsninger

- **Stakke:** Mnemonica er tjekket nøje. Kontrollér Aronson-stakken mod din egen bog første gang (appen viser "K♦ ligger som nr. 26" osv.), eller indsæt din egen stak.
- **Skjult kort-input** gemmes, når du forlader Tidtagninger – husk at gå tilbage til Stopur, før tilskueren starter.

- **Sekunder og minutter kan ikke tvinges usynligt**, hvis tilskueren kigger og stopper langt fra målet – så rammes kun hundrededelene (eller ægte tid). Brug *Blind* eller en rutine, hvor de sigter efter tallet.
- **Stop lige efter Runde i tilstanden Tid:** Hvis tilskueren trykker Runde og under et sekund efter Stop, kan målet i sjældne tilfælde ikke nås uden et synligt spring – så vises ægte tid (1 % i testen). Talrække-tilstandene har ikke det problem.
- **Omgangsrækken** kan i ca. 1 % af runderne skifte sit (lille) sekundtal ved frysning, for at totalen kan blive stående.
- Fanerne **Verdensur, Alarmer og Tidtagninger** er kun kulisser (enkle, iOS-agtige skærme). Kun stopuret virker.
- Skriften er San Francisco på iPhone. På Android/PC bruges systemets skrift; tallene skaleres til samme bredde, men ligner mindre.
- Ikke testet på en fysisk iPhone endnu – tjek især safe-area (notch/Dynamic Island/home-indikator), at 5-tryk øverst til højre registreres i hjemmeskærm-tilstand, og "Føj til hjemmeskærm".

---

## 7. Hvad er testet

`npm test` (Node 18+, ingen afhængigheder) – **40 tests, alle grønne**:

**Rutiner:** alle 14 standardrutiner giver en gyldig plan; hver rutine beholder sine egne tal; ny/omdøb/kopi/flyt/slet/gendan; overlever genindlæsning og flytter gamle egne rutiner over.

**Kort/aktivering:** 3 stakke med 52 forskellige kort, kort skrevet på mange måder (`7h`, `Q♠`, `E♥`, `D♦` = dame), plads med offset/fra bunden, ACAAN-stop (K♦ → `00.07,26`), "force først efter 3 s" (også for talrækker).


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
