# TEL Builds

Static GitHub Pages site for **The Emerging Light** WvW build matrix.



### Equipment sync
The GW2Skills sync also reads the editor preload equipment payload and stores a normalized equipment summary in `data/gw2-build-codes.json`. Build pages render armor/trinket stats, runes, weapon-set stats and sigils, infusions, relic, enrichment, food and utility when present.


## GW2 item/icon cache
The sync workflow caches resolved item metadata in `data/gw2-item-cache.json` and downloads item icons into `assets/gw2/items/`. Existing cached items/icons are reused; only newly encountered equipment names are resolved/downloaded.
