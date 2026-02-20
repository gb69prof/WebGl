# Gravity Lab WebGL — N‑Body realistico (iPad friendly)

Questo mini‑progetto è una simulazione gravitazionale Newtoniana **N‑body** in WebGL usando **Three.js**.

## Come provarlo (GitHub Pages / locale)
1. Metti la cartella su GitHub (es: repo `gravity-lab`)
2. Attiva GitHub Pages (Settings → Pages → Deploy from branch)
3. Apri la pagina dal tuo iPad.

> Nota: se lo apri come file `file://` su iOS, spesso i moduli ES non funzionano.
> Su GitHub Pages o su un piccolo server locale (es: `python -m http.server`) funziona.

## Comandi touch (iPad)
- 1 dito: ruota la camera
- 2 dita: zoom
- Tap su un corpo: selezione + focus
- Modalità “Modifica velocità”: tap sul corpo → trascina → rilascia per applicare Δv
- Modalità “Aggiungi corpo”: tap nel piano → trascina → rilascia per creare un nuovo corpo con v iniziale

## Unità (scelte didattiche)
- Distanza: AU
- Tempo: giorni
- Masse: masse solari (Msun)
- G interno: (2π)^2 / 365.25^2 in AU^3 / (Msun · day^2)

Render: distanze scalate (1 AU = 60 unità di scena). I raggi sono “gonfiati” per visibilità e clampati.

## Suggerimenti
- Se vuoi più realismo e stabilità: diminuisci Δt (0.005 o 0.002) e riduci lo “smorzamento”.
- Se vuoi caos spettacolare: aumenta “G” o crea un corpo vicino a Giove e dagli un kick.

Buon divertimento.
