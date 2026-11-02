# Product catalogue: sources and updates

The shared catalogue only holds what a supplier publishes: name, supplier, category, active
ingredients or nutrient analysis, formulation, and label/SDS links. It never holds rates or
withholding periods. Those depend on the crop, target and label, so they're entered on each job.
Products the catalogue doesn't cover are added by a farm as custom products, marked farm-entered.

| Migration | Source | Retrieved | Coverage |
| --- | --- | --- | --- |
| `0018_catalogue_seed.sql` | Ballance product range page; Ravensdown label PDFs | 2026-10-31 | 94 Ballance fertilisers; 3 Ravensdown fertilisers whose label could be read |
| `0020_spray_catalogue_seed.sql` | nufarm.com/nz product pages; corteva.com/nz crop-protection pages | 2026-11-02 | All 92 Nufarm NZ products listed; the 27 Corteva NZ crop-protection products on its sitemap |

Not yet covered: Bayer, Syngenta, BASF, UPL, Ravensdown-branded agrichemicals, and the rest. The
`catalogue_sources` table holds the same coverage statement, which the app shows.

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
