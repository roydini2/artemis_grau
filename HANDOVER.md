# Handover: Restaurant Artemis — Website

## Projektüberblick

Statische Marketing-Website für **Restaurant Artemis** (griechische Küche, Berlin-Niederschöneweide, Schnellerstr. 97). Sprache der Inhalte: **Deutsch**. Ziel: hochwertige Präsentation mit scrollgesteuerten Canvas-Animationen, redaktionellen Text- und Bildsektionen, rechtlichen Unterseiten und SEO-Grundausstattung.

---

## Tech-Stack

- **HTML5** — eine Hauptseite (`index.html`), rechtliche Seiten als eigene Dateien
- **CSS3** — zentrale Styles in `css/style.css` (kein CSS-Framework)
- **Vanilla JavaScript** — gesamte Interaktion und Animation in `js/app.js`
- **GSAP 3** + **ScrollTrigger** — Scroll-Animationen und Choreografie (CDN)
- **Lenis** — sanftes Scrollen, gekoppelt an GSAP-Ticker (CDN)
- **Canvas 2D** — Frame-Sequenzen für zwei scrollgebundene „Video“-Bereiche (Essen + Statue)
- **PWA-Light** — `manifest.json` für Install-Hinweis / Meta
- **Hosting-Konfiguration** — `vercel.json` (statisches Root-Verzeichnis)

Kein Bundler, kein Build-Schritt: Dateien können direkt auf jedem statischen Webspace liegen.

---

## Kernfunktionen

- **Preloader** mit Ladebalken (wartet u. a. auf erste Canvas-Frames)
- **Zwei Canvas-Scroll-Zonen**: Küche (`#kueche`) mit Food-Frames, Geschichte (`#artemis`) mit Statuen-Frames
- **Smooth Scroll** inkl. Anker-Navigation (Header, Mobile-Menü) mit Offset unter der fixen Kopfzeile
- **Responsives Mobile-Menü** (Hamburger, Escape schließt, Fokus-Labels)
- **GSAP-Reveals** für Sektionen (`data-anim`, ScrollTrigger)
- **Marquee**-Textband (dekorativ)
- **Bewertungs-Sektion** mit animierten Zahlen (Stats)
- **Kontakt**: Öffnungszeiten, Adresse, Telefon, Anfahrt (Bus/S-Bahn)
- **Google Maps** nur nach Einwilligung („Karte laden“) — DSGVO-freundlicher Einstieg
- **Schwebende Aktionen** (FAB): nach oben scrollen, `tel:`-Anruf
- **Rechtliches**: `impressum.html`, `datenschutz.html` (eigenes Layout, gleiche CSS-Basis)
- **SEO**: Meta-Tags, Open Graph, Twitter Cards, JSON-LD `Restaurant`, `canonical`, `robots.txt`, `sitemap.xml`

---

## Wichtige Dateien und Ordner

| Pfad | Inhalt |
|------|--------|
| `index.html` | Gesamte Startseite: Navigation, alle Sektionen, Footer, Script-Einbindungen |
| `css/style.css` | Globales Layout, Typografie, Farben, Komponenten, Legal-Pages |
| `js/app.js` | Lenis, GSAP/ScrollTrigger, Canvas-Logik, Preloader, Map-Consent, Marquee, Counter, FAB |
| `public/` | **Medien und statische Assets**: Bilder (`images/`, u. a. `feier/`), PDFs (`speisekarte/`), Favicons, Open-Graph-Bild |
| `manifest.json` | Web-App-Manifest (Name, Farben, Icons) |
| `impressum.html` / `datenschutz.html` | Impressum und Datenschutz (Inhalt rechtlich pflegen) |
| `robots.txt` | Crawler-Hinweise + Sitemap-URL |
| `sitemap.xml` | Aktuell mit Start-URL (bei Bedarf Unterseiten ergänzen) |
| `vercel.json` | `outputDirectory: "."` — Projektroot ist deploy-fertiges Verzeichnis |
| `frames/` | **Erwartet:** `frame_0001.webp` … `frame_0050.webp` (50 Bilder für Küche-Canvas) |
| `frames-statue/` | **Erwartet:** `frame_0000.webp` … (63 Bilder; Muster in `app.js`: `frames-statue/frame_NNNN.webp`) |

### Sektionen auf der Startseite (Anker-IDs)

Zum Verlinken und Bearbeiten in `index.html`:

- `#hero` — Hero
- `#kueche` — Text neben Food-Canvas-Zone
- `#speisekarte` — Text + PDF-Links + Bildergalerie
- `#terrasse` — Vollbild-Terrasse
- `#willkommen` — Yamas / Willkommen
- `#bewertungen` — Stats + Zitate
- `#artemis` — Text neben Statuen-Canvas-Zone
- `#feiern` — Feiern / Kapazitäten
- `#kontakt` — Kontaktblöcke
- `#reservierung-telefon` — Ziel für „Reservieren“-Buttons
- `#anfahrt` — Anfahrtstext

Navigation (Desktop + Mobile): gleiche Anker wie oben.

### Konfiguration in `js/app.js` (für Entwickler)

Oben im File u. a.:

- `FOOD_FRAME_COUNT`, `STATUE_FRAME_COUNT` — Anzahl Frames
- Pfade: `'frames/frame_NNNN.webp'`, `'frames-statue/frame_NNNN.webp'`
- `FRAME_SPEED`, `IMAGE_SCALE` / `IMAGE_SCALE_MOBILE` — Wiedergabe und Cropping

Änderungen an Frame-Anzahl oder Dateinamen erfordern konsistente Umbenennung der Bilder **und** Anpassung dieser Konstanten.

---

## Lokal testen und deployen

### Lokal

Das Projekt ist **rein statisch**. Ein beliebiger HTTP-Server im **Projektroot** (`artemis_website2`) reicht:

```bash
npx serve .
```

oder z. B. die „Live Preview“-Funktion der IDE. **Wichtig:** Ohne die Ordner `frames/` und `frames-statue/` mit den erwarteten WebP-Dateien bleiben die Canvas-Bereiche leer oder unvollständig — für eine vollständige Abgabe/Demo müssen diese Assets mitgeliefert werden.

### Deploy (Vercel & ähnlich)

- Root-Verzeichnis = Inhalt dieses Ordners (gleiche Ebene wie `index.html`)
- Kein Build-Command nötig (`vercel.json` ist entsprechend gesetzt)
- Alternative: **Netlify**, **GitHub Pages**, **klassisches Shared Hosting** — HTML/CSS/JS und `public/` hochladen, Pfade beibehalten

### Produktions-Domain

In `index.html` sind u. a. `canonical`, `og:url`, `og:image` und JSON-LD auf **`https://restaurant-artemis-berlin.de/`** ausgerichtet. Bei anderer Domain: diese URLs und ggf. `sitemap.xml` / `robots.txt` anpassen.

---

## Hinweise für die Website-Inhaberin / den Inhaber (ohne Code)

### Öffnungszeiten und Ruhetag

- Im **Kontaktbereich** (`#kontakt`) in `index.html`
- Im **Footer** am Seitenende derselben Datei
- In der **JSON-LD-Struktur** im `<head>` von `index.html` (Suchmaschinen)

Alle drei Stellen sollten **übereinstimmen**, sonst wirkt die Seite widersprüchlich.

### Telefon und Reservierung

- Sichtbarer Text: Kontakt-Sektion und Footer in `index.html`
- **Anruf-Button** (FAB unten): `tel:`-Link am Ende von `index.html`
- Hinweis „Nur telefonische Reservierungen“: mehrfach im Fließtext — bei Änderung der Reservierungslogik überall anpassen

### Adresse

- Kontakt, Footer, Schema.org-Block in `index.html`
- Google Maps wird per Suchabfrage eingebettet; bei Adressänderung in `js/app.js` die **Maps-URL** beim `iframe.src` prüfen/anpassen (Suche nach `map-iframe` / `google.com/maps`)

### Speisekarte, Mittagskarte, Eiskarte (PDF)

- Dateien liegen unter `public/speisekarte/` (z. B. `Speisekarte-Artemis.pdf`, `mittagskarte.pdf`, `Eiskarte-Artemis.pdf`)
- Verlinkung in `index.html` im Bereich `#speisekarte` (Klasse `karten-links`)
- Neue PDF-Version: Datei ersetzen **oder** neuen Dateinamen verwenden und **Link im HTML** anpassen

### Bilder tauschen

- Galerien und Hero-relevante Bilder: Pfade wie `public/images/...` in `index.html`
- Terrassen-Hauptbild: `public/images/terasse.webp` (oder Pfad im HTML ändern)
- **Alt-Texte** (`alt="..."`) für Barrierefreiheit und SEO mit anpassen

### Rechtstexte

- **Impressum** und **Datenschutz** in den jeweiligen HTML-Dateien; bei rechtlichen Änderungen Datum/„Stand“ aktualisieren
- Datenschutz enthält u. a. einen Abschnitt zu **Google Maps** (Anker `#google-maps` für Link von der Karte)

### Bewertungszahlen und Zitate

- Sichtbare Stats und Zitate: Sektion `#bewertungen` in `index.html`
- JSON-LD `aggregateRating` im `<head>`: nur anpassen, wenn die Angaben **faktisch** stimmen und rechtlich unbedenklich sind

---

## Abgabe-Checkliste (Studium / Projekt)

- [ ] `index.html`, `css/style.css`, `js/app.js`
- [ ] `impressum.html`, `datenschutz.html`
- [ ] `public/` vollständig (Bilder, PDFs, Favicon, Open-Graph-Bild)
- [ ] `frames/` und `frames-statue/` mit allen WebP-Frames (siehe Konstanten in `app.js`)
- [ ] `manifest.json`, `robots.txt`, `sitemap.xml` (optional: Sitemap um Impressum/Datenschutz erweitern)
- [ ] `vercel.json` falls Deployment mit Vercel vorgegeben ist
- [ ] Kurztest: Mobile Menü, Anker-Links, Karte laden, PDF-Links, Telefon-Link

---

## Sonstiges

- Der Ordner **`tools/`** (z. B. FFmpeg) steht in `.gitignore` — Werkzeuge für Medienproduktion, **nicht** für den Live-Betrieb der Website nötig.
- **`.cursor/`** ist entwicklerbezogen und typischerweise nicht Teil einer Studienabgabe, sofern nicht explizit verlangt.

Bei Fragen zur Architektur: zuerst `index.html` (Struktur), dann `js/app.js` (Verhalten), dann `css/style.css` (Darstellung).
