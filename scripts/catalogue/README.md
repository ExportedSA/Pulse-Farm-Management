# Product catalogue: sources and updates

The shared catalogue only holds what a supplier publishes: name, supplier, category, active
ingredients or nutrient analysis, formulation, and label/SDS links. It never holds rates or
withholding periods. Those depend on the crop, target and label, so they're entered on each job.
Products the catalogue doesn't cover are added by a farm as custom products, marked farm-entered.

| Migration | Source | Retrieved | Coverage |
| --- | --- | --- | --- |
| `0018_catalogue_seed.sql` | Ballance product range page; Ravensdown label PDFs | 2026-10-31 | 94 Ballance fertilisers; 3 Ravensdown fertilisers whose label could be read |
| `0020_spray_catalogue_seed.sql` | nufarm.com/nz product pages; corteva.com/nz crop-protection pages | 2026-11-02 | All 92 Nufarm NZ products listed; the 27 Corteva NZ crop-protection products on its sitemap |
| `0023_catalogue_more_suppliers.sql` | Bayer, BASF, Syngenta, Orion AgriScience, AGPRO and UPL NZ product pages; Yara NZ product pages; Fertco product sheets | 2026-11-07 | 337 sprays (33 Bayer, 28 BASF, 44 Syngenta, 90 Orion, 57 AGPRO, 85 UPL); 20 Yara and 19 Fertco fertilisers |

Not yet covered: ADAMA, FMC, Gowan, Grochem and Ravensdown-branded agrichemicals, and Ravensdown's
fertiliser range. Their sites refused reading (access denied or a CAPTCHA) on 2026-11-07. The
`catalogue_sources` table holds the same coverage statement, which the app shows.

Nutrients a supplier doesn't list are stored as NULL, not zero. Job, season and report totals count
the nutrients that are stated and list the ones that aren't, e.g. "P, K, S not stated in its analysis".

## The 2026-11-07 update

`sprays-nz-2026-11-07.json` and `fertilisers-nz-2026-11-07.json` hold one row per product as read
from the pages (active-ingredient text as printed, formulation, ACVM number where shown, label/SDS
links; nutrient % for fertilisers). `catalogue_seed_2026_11.py` turns them into the migration and
prints every product for checking:

`python -I scripts/catalogue/catalogue_seed_2026_11.py scripts/catalogue/sprays-nz-2026-11-07.json scripts/catalogue/fertilisers-nz-2026-11-07.json scripts/migrations/0023_catalogue_more_suppliers.sql`

Left out on purpose: BASF Pest Control products (urban pests, rodent baits), UPL pheromone traps,
lures and mating-disruption dispensers, AGPRO taps, pumps and scoops, Syngenta products marked
discontinued, YaraVita liquids (the page doesn't say whether % is by weight or volume), and Fertco
sheets with no readable analysis. Fertco sheets don't say elemental or oxide; their figures match
elemental and are stored that way, which each product's source note says.

## Updating the spray catalogue

1. Open each product page in a normal browser session. Don't get round bot protection: if a site
   blocks reading, use its label PDFs instead, or leave it out.
2. Save the extracted pages as JSON in the shape of `nufarm-nz-2026-11-02.json`:
   `{ u, name, ex, label, sds, snip }` per product.
3. Run `python -I scripts/catalogue/spray_seed.py <pages.json> scripts/migrations/NNNN_spray_catalogue_update.sql`.
   The script prints every product with its category, formulation and actives. Check that list
   against the pages before applying it.
4. Rows are inserted only where no shared product has the same `source_url`. Before changing an
   existing product, archive it (`archived_at`) and insert the new version. Never edit it in place.
   Completed jobs keep their own snapshot either way.
5. Update `catalogue_sources` with the new retrieval date and coverage.
