"""Build scripts/migrations/0023_catalogue_more_suppliers.sql from the supplier pages read on 2026-11-07.

argv[1]: sprays JSON (sprays-nz-2026-11-07.json), argv[2]: fertilisers JSON (fertilisers-nz-2026-11-07.json),
argv[3]: the migration to write.

Only what the pages state is stored: for sprays the name, category, active ingredients and concentrations,
formulation, ACVM number where the page prints it, and label/SDS links; for fertilisers the nutrient
percentages the page lists. No rates or withholding periods. A value the page doesn't give stays NULL."""
import json, re, sys

RETRIEVED = '2026-11-07'
sprays = json.load(open(sys.argv[1], encoding='utf-8'))
ferts = json.load(open(sys.argv[2], encoding='utf-8'))

# ----- formulation -----
FORMS = [
    'water dispersible granule', 'water-dispersible granule', 'wettable granule', 'water soluble granule', 'soluble granule',
    'wettable powder', 'soluble concentrate', 'soluble liquid', 'suspension concentrate', 'emulsifiable concentrate',
    'capsule suspension', 'suspo-emulsion', 'oil in water emulsion', 'oil-in-water emulsion', 'oil and water emulsion',
    'emulsion in water', 'oil in water dispersion', 'oil dispersion', 'flowable concentrate', 'microemulsion',
    'oil miscible liquid', 'smoke generator', 'granular bait', 'bait', 'pellet', 'gel', 'granule', 'dust', 'liquid',
]
FORM_ALIAS = {'water-dispersible granule': 'water dispersible granule', 'oil-in-water emulsion': 'oil in water emulsion',
              'oil and water emulsion': 'oil in water emulsion', 'emulsion in water': 'oil in water emulsion',
              'soluble liquid': 'soluble concentrate', 'oil in water dispersion': 'oil dispersion'}
SOLID = ('granule', 'powder', 'pellet', 'bait', 'dust', 'smoke')
LIQ_UNITS = ['L/ha', 'mL/ha', 'L/100L', 'mL/100L']
SOL_UNITS = ['kg/ha', 'g/ha', 'kg/100L', 'g/100L']

def formulation(*texts):
    for t in texts:
        if not t:
            continue
        low = re.sub(r'\s+', ' ', t).lower().replace('granules', 'granule')
        hits = [(low.find(f), -len(f), f) for f in FORMS if f in low]
        if hits:
            f = min(hits)[2]
            return FORM_ALIAS.get(f, f)
    return None

def units(form):
    if not form:
        return LIQ_UNITS + SOL_UNITS
    if form == 'gel':
        return LIQ_UNITS + SOL_UNITS
    return SOL_UNITS if any(s in form for s in SOLID) else LIQ_UNITS

# ----- active ingredients -----
UNIT = r'(g\s*/\s*(?:litre|Litre|L|l|kg|Kg)\b|mL/L|%)'
NUM = r'(\d+(?:\.\d+)?)'
CONC_FIRST = re.compile(r'^' + NUM + r'\s*' + UNIT + r'\s*(?:of\s+)?(.*)$')
NAME_THEN_CONC = re.compile(r'^(.*?)\s*\(?\s*' + NUM + r'\s*' + UNIT + r'\s*\)?\s*(.*)$')

def norm_unit(u):
    u = re.sub(r'\s+', '', u).replace('litre', 'L').replace('Litre', 'L').replace('Kg', 'kg')
    return 'g/L' if u == 'g/l' else u

def tidy(name):
    name = re.sub(r'\s+in the form\b.*$', '', name, flags=re.I)
    name = re.sub(r'\s*\[[^\]]*\]\s*', ' ', name)
    name = re.sub(r'\s+as an? (?:emulsifiable concentrate|soluble concentrate|water dispersible granule|dust|oil miscible liquid).*$', '', name, flags=re.I)
    name = re.sub(r'\s+(?:both\s+)?as the\s*$', '', name)
    name = re.sub(r'^an?\s+(?=[A-Z])', '', name)
    return re.sub(r'\s+', ' ', name).strip(' ,.;"+')

def one_active(p):
    """One ingredient, written either way round: "490 g/litre 2,4-D ..." or "Triclopyr 600 g/litre as the ... ester"."""
    p = p.strip()
    if re.match(r'(?i)(?:greater than|more than|not less than|less than|at least|minimum)\b', p):
        return {'name': tidy(p), 'concentration': None, 'unit': None}  # a bound, not a concentration
    m = CONC_FIRST.match(p)
    if m:
        return {'name': tidy(m.group(3)), 'concentration': float(m.group(1)), 'unit': norm_unit(m.group(2))}
    m = NAME_THEN_CONC.match(p)
    # A range ("400 – 600 g/L") or a count ("2.0x10 9 cfu") isn't one concentration: keep the text as printed
    if m and m.group(1) and not re.search(r'[\d–<>-]\s*$', m.group(1)) and not re.search(r'cfu', p, re.I):
        name = (m.group(1) + (' ' + m.group(4) if m.group(4) else '')).strip()
        return {'name': tidy(name), 'concentration': float(m.group(2)), 'unit': norm_unit(m.group(3))}
    return {'name': tidy(p), 'concentration': None, 'unit': None}

def actives_from_text(text):
    if not text:
        return []
    t = re.sub(r'\s+', ' ', text).strip().rstrip('."')
    t = re.sub(r'^(?:Contains:?\s*)+', '', t, flags=re.I)
    t = re.sub(r'^[^,]*?(?:Herbicide|Insecticide|Fungicide|Seed Treatment)s?,\s*', '', t)
    t = re.sub(r'g/L(?!itre)(?=[a-z])', 'g/L ', t)  # "250 g/Lfatty acids"
    t = re.sub(r'\s+in the form\b.*$', '', t, flags=re.I)
    t = re.sub(r'\.\s*Also contains.*$', '', t, flags=re.I)
    minimum = bool(re.match(r'(?i)a minimum of\s+', t))
    t = re.sub(r'(?i)^a minimum of\s+', '', t)
    # Keep "(bicarbonate and carbonate)" in one piece while splitting the list
    guarded = re.sub(r'\([^)]*\)', lambda m: m.group(0).replace(' and ', ' \x01 ').replace(',', '\x02'), t)
    # "and" separates two actives only next to a concentration ("840 g/litre and alpha-cypermethrin 6 g/litre",
    # "phenmedipham and 160 g/L desmedipham"); "mono and di-ammonium" stays one name
    pieces = re.split(r'\s*(?:\+|;|\bplus\b|(?:(?<=g/L)|(?<=g/l)|(?<=itre)|(?<=g/kg)|(?<=g/Kg)|(?<=%))\s+and\b|\band\b(?=\s*(?:\d|minimum\b))|,\s+(?=[\dA-Za-z]))\s*', guarded)
    out = []
    for p in pieces:
        p = p.replace('\x01', 'and').replace('\x02', ',').strip()
        if p:
            out.append(one_active(p))
    # "100 g/L A 50 g/L B" (no separator): split where a new concentration starts after a name
    flat = []
    for a in out:
        m = re.match(r'^(.*?)\s+' + NUM + r'\s*' + UNIT + r'\s+(.+)$', a['name'])
        if a['concentration'] is not None and m and not re.search(r'\d$', m.group(1)):
            flat.append({**a, 'name': tidy(m.group(1))})
            flat.append({'name': tidy(m.group(4)), 'concentration': float(m.group(2)), 'unit': norm_unit(m.group(3))})
        else:
            flat.append(a)
    if minimum and flat:
        flat[0]['name'] += ' (minimum)'
    return [a for a in flat if a['name']]

def bayer_actives(rows):
    out = []
    for r in rows:
        m = NAME_THEN_CONC.match(r['text'])
        if m and (re.search(r'[\d–<>-]\s*$', m.group(1)) or m.group(4) or re.search(r'CFU', r['text'], re.I)):
            m = None
        a = ({'name': tidy(m.group(1)), 'concentration': float(m.group(2)), 'unit': norm_unit(m.group(3))} if m
             else {'name': r['text'], 'concentration': None, 'unit': None})  # ranges and counts kept as printed
        if r.get('group'):
            a['group'] = r['group']
        out.append(a)
    return out

def q(v):
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"
def arr(a):
    return "ARRAY[" + ", ".join(q(x) for x in a) + "]::text[]" if a else "'{}'::text[]"
def num(v):
    return 'NULL' if v is None else repr(float(v))

out = ["-- Catalogue: more NZ agrichemical and fertiliser suppliers, retrieved " + RETRIEVED + ".",
       "-- Generated by scripts/catalogue/catalogue_seed_2026_11.py from the supplier pages; nothing here is invented.",
       "-- A value a page doesn't give is NULL (unknown), never zero.", ""]
SPRAY_NOTE = ("Name, active ingredients, concentrations and formulation as published on the supplier's NZ product page. "
              "Rates and withholding periods are on the label and are not stored: check the label for each use.")
rows = []
for s in sprays:
    acts = bayer_actives(s['actives']) if s.get('actives') else actives_from_text(s.get('actives_text'))
    form = formulation(s.get('formulation'), s.get('actives_text'))
    u = units(form)
    note = SPRAY_NOTE + (' ' + s['note'] if s.get('note') else '')
    if not acts:
        note += " The page doesn't list the active ingredients."
    rows.append((s, acts, form, u))
    out.append(
        "INSERT INTO input_products (farm_id, kind, name, supplier, category, formulation, units, active_ingredients, registration_number, "
        "label_url, sds_url, source_url, source_note, verified_on, verification, rate_unit) "
        f"SELECT NULL, 'spray', {q(s['name'])}, {q(s['supplier'])}, {q(s['category'])}, {q(form)}, {arr(u)}, "
        f"{q(json.dumps(acts, ensure_ascii=False))}::jsonb, {q(s.get('registration'))}, {q(s.get('label_url'))}, {q(s.get('sds_url'))}, "
        f"{q(s['source_url'])}, {q(note)}, DATE '{RETRIEVED}', 'verified', {q(u[0])} "
        f"WHERE NOT EXISTS (SELECT 1 FROM input_products WHERE farm_id IS NULL AND kind = 'spray' AND source_url = {q(s['source_url'])});")

out.append("")
for f in ferts:
    out.append(
        "INSERT INTO input_products (kind, name, supplier, category, n_percent, p_percent, k_percent, s_percent, mg_percent, ca_percent, "
        "analysis_basis, units, label_url, source_url, source_note, verified_on, verification) "
        f"SELECT 'fertiliser', {q(f['name'])}, {q(f['supplier'])}, {q(f['category'])}, {num(f['N'])}, {num(f['P'])}, {num(f['K'])}, "
        f"{num(f['S'])}, {num(f['Mg'])}, {num(f['Ca'])}, 'elemental', '{{kg/ha,t/ha}}', {q(f.get('label_url'))}, {q(f['source_url'])}, "
        f"{q(f['note'])}, DATE '{RETRIEVED}', 'verified' "
        f"WHERE NOT EXISTS (SELECT 1 FROM input_products WHERE farm_id IS NULL AND supplier = {q(f['supplier'])} AND name = {q(f['name'])});")

count = lambda sup: sum(1 for s in sprays if s['supplier'] == sup)
fcount = lambda sup: sum(1 for f in ferts if f['supplier'] == sup)
out.append("")
out.append(f"""INSERT INTO catalogue_sources (id, name, url, coverage, retrieved_on, notes) VALUES
  ('bayer-nz', 'Bayer Crop Science New Zealand', 'https://www.cropscience.bayer.co.nz/crop-protection/herbicide',
   'All {count('Bayer Crop Science New Zealand')} products on the herbicide, fungicide, insecticide, biological and SeedGrowth pages on the retrieval date.',
   DATE '{RETRIEVED}', 'Active ingredients (with mode-of-action group) and formulation from each product page. Label links are not on the page.'),
  ('basf-nz', 'BASF Crop Solutions New Zealand', 'https://crop-solutions.basf.co.nz/sitemap.xml',
   'The {count('BASF New Zealand')} crop products on the NZ site on the retrieval date. BASF Pest Control products (urban pests, rodent baits) are left out.',
   DATE '{RETRIEVED}', 'ACVM number, actives, formulation, label and SDS links from each product page.'),
  ('syngenta-nz', 'Syngenta New Zealand crop protection', 'https://www.syngenta.co.nz/products/search/crop-protection',
   'The {count('Syngenta New Zealand')} current crop-protection products listed on the retrieval date (2 marked discontinued are left out).',
   DATE '{RETRIEVED}', 'ACVM number, composition and formulation from each product page. Labels are on Syngenta''s label download page, not linked per product.'),
  ('orion-nz', 'Orion AgriScience', 'https://www.orionagriscience.co.nz/sitemap.xml',
   'The {count('Orion AgriScience')} products on the herbicide, insecticide, fungicide, adjuvant, seed treatment and other pages on the retrieval date.',
   DATE '{RETRIEVED}', 'Actives as published in each product page''s description. Formulation only where the page states it. Labels are not linked.'),
  ('agpro-nz', 'AGPRO New Zealand', 'https://agpro.co.nz/collections/all',
   'The {count('AGPRO New Zealand')} agrichemicals and adjuvants in the online range on the retrieval date (taps, pumps and measuring scoops left out).',
   DATE '{RETRIEVED}', 'Actives from each product page; label and SDS links where the page gives them.'),
  ('upl-nz', 'UPL New Zealand', 'https://www.uplcorp.com/nz/crop-product-portfolio',
   'The {count('UPL New Zealand')} products in the NZ portfolio on the retrieval date. Pheromone traps, lures and mating-disruption dispensers are left out.',
   DATE '{RETRIEVED}', 'Formulation and actives from each product page; label and SDS links. Some pages name an active without its concentration, which is left blank.'),
  ('yara-nz', 'Yara New Zealand fertilisers', 'https://www.yara.co.nz/crop-nutrition/fertilisers/',
   'The {fcount('Yara New Zealand')} granular, prilled and powder fertilisers on the YaraBela, YaraLiva, YaraMila, YaraTera, YaraVera and YaraVita pages on the retrieval date.',
   DATE '{RETRIEVED}', 'Elemental % from each page''s nutrient composition. Nutrients a page doesn''t list are blank, not zero. YaraVita liquids are left out because the page doesn''t say whether % is by weight or volume.'),
  ('fertco-nz', 'Fertco product sheets', 'https://www.fertco.co.nz/resources/',
   'The {fcount('Fertco')} Fertco products with a product sheet that gives a chemical analysis on the retrieval date.',
   DATE '{RETRIEVED}', 'Figures from each sheet''s Chemical Analysis box, stored as elemental (the sheets don''t say). Nutrients a sheet doesn''t list are blank, not zero. Custom blends and products without a sheet are not included.'),
  ('spray-not-covered', 'Not yet in the catalogue', 'https://www.mpi.govt.nz/agriculture/agricultural-compounds-vet-medicines/acvm-registers-and-lists',
   'Sprays: ADAMA, FMC, Gowan, Grochem and Ravensdown-branded agrichemicals. Fertilisers: Ravensdown''s full range. Their websites refused automated or browser reading (access denied or a CAPTCHA) on the retrieval date. Add them as custom products, or extend the catalogue from their labels.',
   DATE '{RETRIEVED}', 'Update process: scripts/catalogue/README.md.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, coverage = EXCLUDED.coverage, retrieved_on = EXCLUDED.retrieved_on, notes = EXCLUDED.notes;""")
open(sys.argv[3], 'w', encoding='utf-8').write("\n".join(out) + "\n")

for s, acts, form, u in rows:
    print(s['supplier'][:10].ljust(10), '|', s['name'][:32].ljust(32), '|', s['category'][:10].ljust(10), '|', (form or '-')[:24].ljust(24), '|',
          '; '.join(f"{a['concentration'] if a['concentration'] is not None else '?'} {a['unit'] or ''} {a['name']}" for a in acts) or '(none listed)')
for f in ferts:
    print(f['supplier'][:10].ljust(10), '|', f['name'][:32].ljust(32), '|', ' '.join(f"{k}{f[k]}" for k in ('N', 'P', 'K', 'S', 'Mg', 'Ca') if f[k] is not None))
