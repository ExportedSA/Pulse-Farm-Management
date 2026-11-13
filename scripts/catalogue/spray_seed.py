"""Build scripts/migrations/0020_spray_catalogue_seed.sql from the Nufarm NZ and Corteva NZ product pages
(retrieved 2026-11-02). Only what the pages state is stored: name, category, active ingredients and
concentrations, formulation, label/SDS links. No rates, withholding periods or registration numbers."""
import json, re, sys

RETRIEVED = '2026-11-02'
# argv[1]: the extracted Nufarm product pages (see README); argv[2]: the migration to write
nf = json.load(open(sys.argv[1], encoding='utf-8'))

FORMS = [
    'dust-free, water-dispersible granule', 'water dispersible granule', 'water-dispersible granule', 'water soluble granule',
    'water soluble powder', 'soluble granule', 'soluble concentrate', 'suspension concentrate', 'emulsifiable concentrate',
    'capsule suspension', 'oil in water emulsion', 'water emulsion', 'slow release granule', 'granular bait',
    'seed dressing', 'oil dispersion', 'dispersible granules', 'pellet', 'gel', 'liquid',
]
SOLID = ('granule', 'powder', 'pellet', 'bait', 'dispersible granules')
LIQ_UNITS = ['L/ha', 'mL/ha', 'L/100L', 'mL/100L']
SOL_UNITS = ['kg/ha', 'g/ha', 'kg/100L', 'g/100L']

def formulation(*texts):
    for t in texts:
        if not t:
            continue
        low = re.sub(r'\s+', ' ', t).lower()
        if re.search(r'\bas wdg\b', low): return 'water dispersible granule'
        if re.search(r'\bas an sc\b', low): return 'suspension concentrate'
        hits = [(low.find(f), f) for f in FORMS if f in low]
        if hits:
            return min(hits)[1]
    return None

def units(form):
    if not form:
        return LIQ_UNITS + SOL_UNITS
    if form == 'gel':
        return LIQ_UNITS + SOL_UNITS
    return SOL_UNITS if any(s in form for s in SOLID) else LIQ_UNITS

CUT = r'\s+(?:Pack sizes|in the form|Similar Products|Forumulation|Formulation|Cleans|Foam Wrecker is|Foam Marker is|Amigo is|Why use|Contact Xcel|TALK TO US|Now registered|Application Method|Rates|Mode of Action|Formulations)\b.*$'
def actives(text):
    if not text:
        return []
    t = re.sub(CUT, '', text).strip().rstrip('.')
    t = re.sub(r'\s+as (?:WDG|an SC)$', '', t)
    parts = re.split(r'\s*(?:,\s+(?=\d)|\band\b(?=\s*\d)|\+(?=\s*\d)|\bplus\b(?=\s*\d))\s*', t)
    out = []
    for p in parts:
        p = p.strip(' ,.')
        if not p:
            continue
        m = re.match(r'^([\d.,]+)\s*(?:×\s*10⁹\s*)?(g/L|g/litre|g/kg|g/Kg|cfu/g|International Units)\s*(.*)$', p)
        if m:
            conc = float(m.group(1).replace(',', ''))
            unit = m.group(2).replace('litre', 'L').replace('Kg', 'kg')
            name = m.group(3).strip()
            if p.startswith('5 ×'):
                conc, unit = None, None
            out.append({'name': name[:120], 'concentration': conc, 'unit': unit})
        else:
            out.append({'name': p[:120], 'concentration': None, 'unit': None})
    return out

ACTIVE_OVERRIDE = {  # page text that the general parser can't split; values as printed on the page
    'dipel': [{'name': 'Bacillus thuringiensis var. kurstaki (H-3a, 3b HD1)', 'concentration': 32000, 'unit': 'IU/mg'}],
    'botector': [{'name': 'Aureobasidium pullulans (5 × 10⁹ cfu/g)', 'concentration': None, 'unit': None}],
}
CAT_OVERRIDE = {  # where the keyword rule picked the wrong one; each follows the page wording
    'mainman': 'insecticide',          # "For the control of aphids and psylids"
    'senator-600': 'insecticide',      # formulation line: "Seed Dressing Insecticide"
    'pulse-penetrant': 'adjuvant',     # "Product Type: Adjuvant"
    'freeway': 'adjuvant',             # "Organosilicone surfactant"
}
def category(slug, typ, ex):
    if slug in CAT_OVERRIDE:
        return CAT_OVERRIDE[slug]
    e = f'{typ or ""} {ex}'.lower()
    if 'insect' in e: return 'insecticide'
    if 'molluscicide' in e or 'slug' in e: return 'molluscicide'
    if re.search(r'herbicide|weed|nutsedge|buttercup|dock', e): return 'herbicide'
    if re.search(r'fungicide|disease|botrytis|sclerotinia', e): return 'fungicide'
    if 'growth regulator' in e or 'stimulates' in e: return 'plant growth regulator'
    if re.search(r'adjuvant|surfactant|anti-foam|drift|spreader|penetra', e): return 'adjuvant'
    return 'other'

def clean_name(n):
    n = re.sub(r'\s*\((?:NEW)\)\s*', '', n)
    n = re.sub(r'\s+[–-]\s+(?:New|new).*$', '', n)
    return n.replace('®', '').replace('™', '').strip()

rows = []
for o in nf:
    slug = o['u'].split('/product/')[1].strip('/')
    s = o['snip'] + ' $'
    typ = (re.search(r'Product Type:\s*(.*?)\s+(?:Active|Formulation)', s) or [None, None])[1]
    act_m = re.search(r'Active Ingredients?:\s*(.*?)\s*(?=Formulation:|Key benefits|Key Benefits|We use cookies|Contact us|\$)', s, re.I)
    form_m = re.search(r'Formulation:\s*(.*?)(?=\s+[A-Z][a-z]|\$)', s)
    act_text = act_m.group(1) if act_m else None
    form = formulation(form_m.group(1) if form_m else None, act_text, o['snip'][o['snip'].find('Formulation'):][:120] if 'Formulation' in o['snip'] else None)
    acts = ACTIVE_OVERRIDE.get(slug) or actives(act_text)
    rows.append(dict(
        name=clean_name(o['name']), supplier='Nufarm New Zealand', category=category(slug, typ, o['ex']),
        formulation=form, units=units(form), actives=acts, label=o['label'], sds=o['sds'], source=o['u'],
        alias=[clean_name(o['name']).lower()] if clean_name(o['name']) != o['name'] else [],
    ))

# Corteva NZ product pages (crop protection), technical specifications as published
CT = [
    ('korvetto-arylex-active', 'Korvetto with Arylex active', 'herbicide', 'Arylex active + clopyralid', 'NeoEC with built in MSO adjuvant'),
    ('milestone', 'Milestone', 'herbicide', '60g/L aminopyralid plus 276g/L clopyralid', 'soluble concentrate'),
    ('paradigm-arylex-active', 'Paradigm with Arylex active', 'herbicide', '200 g/kg halauxifen-methyl, 200 g/kg florasulam', 'water dispersible granule'),
    ('rexade-arylex-active', 'Rexade GoDRI with Arylex active', 'herbicide', '50 g/kg Arylex active, 150 g/kg pyroxsulam', 'water dispersible granule'),
    ('tordon-brushkiller-xt', 'Tordon Brushkiller XT', 'herbicide', '100 g/L picloram, 8 g/L aminopyralid, 300g/L triclopyr', 'emulsifiable concentrate'),
    ('tordon-pastureboss', 'Tordon PastureBoss', 'herbicide', '30 g/litre aminopyralid, 200 g/litre triclopyr', None),
    ('gallant-ultra', 'Gallant Ultra', 'herbicide', '520 g/litre haloxyfop-P-methyl', 'emulsifiable concentrate'),
    ('versatill-powerflo', 'Versatill PowerFlo', 'herbicide', '600g/litre clopyralid', 'soluble concentrate'),
    ('TwinGuard-isoclast-active', 'TwinGuard with Isoclast active', 'insecticide', '200 g/kg spinetoram and 200 g/kg sulfoxaflor', None),
    ('entrust-sc-naturalyte', 'Entrust SC Naturalyte', 'insecticide', '240 g/L spinosad', None),
    ('prodigy', 'Prodigy', 'insecticide', '240 g/L methoxyfenozide', 'suspension concentrate'),
    ('sparta', 'Sparta', 'insecticide', '120 g/L spinetoram', 'suspension concentrate'),
    ('Transform-Isoclast-active', 'Transform with Isoclast active', 'insecticide', '240 g/litre Isoclast active', None),
    ('fontelis', 'Fontelis', 'fungicide', '200 g/L penthiopyrad', 'suspension concentrate'),
    ('kocide-opti', 'Kocide Opti', 'fungicide', '300 g/kg copper', 'dispersible granules'),
    ('questar', 'Questar with Inatreq active', 'fungicide', '50g/L Inatreq active', None),
    ('talendo', 'Talendo', 'fungicide', '200 g/L proquinazid', 'emulsifiable concentrate'),
    ('zorvec-enicade-ranman-copack', 'Zorvec Enicade - Ranman Fungicide Co-Pack', 'fungicide', '100 g/L oxathiapiprolin + 400 g/L cyazofamid', 'oil dispersion'),
    ('uptake', 'Uptake Spraying Oil', 'adjuvant', '582 g/L paraffinic oil, 240 g/L alkoxylated alcohol non-ionic surfactants', None),
    ('starane-xtra', 'Starane Xtra', 'herbicide', '333 g/L fluroxypyr', 'emulsifiable concentrate'),
    ('kerb', 'Kerb 500F', 'herbicide', '500 g/L propyzamide', 'suspension concentrate'),
    ('tordon-2g-gold', 'Tordon 2G Gold', 'herbicide', '20 g/kg picloram, 0.25 g/kg aminopyralid', 'pellet'),
    ('preside', 'Preside', 'herbicide', '800 g/kg flumetsulam', 'water dispersible granule'),
    ('t-max', 'T-Max', 'herbicide', '30 g/L aminopyralid', 'soluble concentrate'),
    ('grazon', 'Grazon', 'herbicide', '600 g/litre triclopyr', 'emulsifiable concentrate'),
    ('radiate', 'Radiate', 'herbicide', '150 g/L picloram, 225 g/L clopyralid', 'soluble concentrate'),
    ('vigilant-ii', 'Vigilant II', 'herbicide', '43 g/kg picloram, 4.3 g/kg aminopyralid', 'gel'),
]
for slug, name, cat, act, form in CT:
    if slug == 'tordon-pastureboss':
        u = LIQ_UNITS  # the page gives knapsack, handgun and boom water volumes for a liquid
    else:
        u = units(form) if form != 'NeoEC with built in MSO adjuvant' else LIQ_UNITS
    rows.append(dict(
        name=name, supplier='Corteva Agriscience', category=cat, formulation=form, units=u, actives=actives(act),
        label=None, sds=None, source=f'https://www.corteva.com/nz/products-and-solutions/crop-protection/{slug}.html', alias=[],
    ))

def q(v):
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"
def arr(a):
    return "ARRAY[" + ", ".join(q(x) for x in a) + "]::text[]" if a else "'{}'::text[]"

note = ("Name, active ingredients, concentrations and formulation as published on the supplier's NZ product page. "
        "Rates, ACVM registration and withholding periods are on the label and are not stored: check the label for each use.")
out = ["-- Spray catalogue: Nufarm NZ (all products listed) and Corteva NZ crop protection (all listed on the NZ sitemap),",
       f"-- retrieved {RETRIEVED}. Generated by scripts/catalogue/spray_seed.py; nothing here is invented or inferred beyond the supported units.", ""]
for r in rows:
    out.append(
        "INSERT INTO input_products (farm_id, kind, name, supplier, category, formulation, units, active_ingredients, label_url, sds_url, "
        "source_url, source_note, verified_on, verification, aliases, rate_unit) "
        f"SELECT NULL, 'spray', {q(r['name'])}, {q(r['supplier'])}, {q(r['category'])}, {q(r['formulation'])}, {arr(r['units'])}, "
        f"{q(json.dumps(r['actives'], ensure_ascii=False))}::jsonb, {q(r['label'])}, {q(r['sds'])}, {q(r['source'])}, {q(note)}, "
        f"DATE '{RETRIEVED}', 'verified', {arr(r['alias'])}, {q(r['units'][0])} "
        f"WHERE NOT EXISTS (SELECT 1 FROM input_products WHERE farm_id IS NULL AND kind = 'spray' AND source_url = {q(r['source'])});")
out.append("")
out.append(f"""INSERT INTO catalogue_sources (id, name, url, coverage, retrieved_on, notes) VALUES
  ('nufarm-nz', 'Nufarm New Zealand product range', 'https://nufarm.com/nz/all-products/',
   'All {sum(1 for r in rows if r['supplier'].startswith('Nufarm'))} products listed on the all-products pages on the retrieval date: herbicides, insecticides, fungicides, adjuvants, growth regulators and others.',
   DATE '{RETRIEVED}', 'Active ingredients and formulation from each product page; label and SDS links where the page gives them. ACVM numbers, rates and withholding periods are not stored.'),
  ('corteva-nz', 'Corteva Agriscience NZ crop protection', 'https://www.corteva.com/nz/sitemap.html',
   'The {sum(1 for r in rows if r['supplier'].startswith('Corteva'))} crop-protection products on the NZ sitemap on the retrieval date.',
   DATE '{RETRIEVED}', 'Technical specifications from each product page. Formulation is blank where the page does not give it. Korvetto concentrations are not on its page.'),
  ('spray-not-covered', 'Not yet in the spray catalogue', 'https://www.mpi.govt.nz/agriculture/agricultural-compounds-vet-medicines/acvm-registers-and-lists',
   'Bayer, Syngenta, BASF, UPL, Ravensdown-branded and other suppliers are not included yet. Add them as custom products, or extend the catalogue from their NZ labels.',
   DATE '{RETRIEVED}', 'Update process: re-run the catalogue import against each supplier page, then compare with the previous version before replacing.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, coverage = EXCLUDED.coverage, retrieved_on = EXCLUDED.retrieved_on, notes = EXCLUDED.notes;""")
open(sys.argv[2], 'w', encoding='utf-8').write("\n".join(out) + "\n")
cats = {}
for r in rows:
    cats[r['category']] = cats.get(r['category'], 0) + 1
print(len(rows), cats)
for r in rows:
    print(r['name'], '|', r['category'], '|', r['formulation'], '|', '; '.join(f"{a['concentration']} {a['unit']} {a['name']}" for a in r['actives']))
