import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MapError, rowsOf } from './farm-map';

// Product catalogue: the verified shared list (each entry has its source and the date it was
// checked) plus each farm's own products, which stay marked farm-entered until checked.
// Every change keeps the previous details as a version, and jobs save the version they used.

export const PRODUCT_KINDS = ['fertiliser', 'spray', 'effluent'] as const;
export const FERTILISER_CATEGORIES = ['nitrogen', 'phosphate', 'potassium', 'sulphur', 'lime', 'calcium', 'magnesium', 'trace', 'liquid', 'compound', 'blend'] as const;
export const SPRAY_CATEGORIES = ['herbicide', 'insecticide', 'fungicide', 'adjuvant', 'wetting agent', 'plant growth regulator', 'molluscicide', 'other'] as const;

// Converting oxide-basis analyses (P2O5, K2O, SO3, MgO, CaO) to elemental, by molar mass
export const OXIDE_TO_ELEMENT: Record<string, number> = { P: 0.4364, K: 0.8301, S: 0.4005, Mg: 0.6030, Ca: 0.7147 };
const NUTRIENTS = ['N', 'P', 'K', 'S', 'Mg', 'Ca'] as const;
type Nutrients = Partial<Record<typeof NUTRIENTS[number], number | null>>;

const COLUMNS = sql`p.id, p.farm_id AS "farmId", p.kind, p.name, p.supplier, p.category, p.formulation, p.units,
  p.n_percent::float AS "N", p.p_percent::float AS "P", p.k_percent::float AS "K", p.s_percent::float AS "S",
  p.mg_percent::float AS "Mg", p.ca_percent::float AS "Ca", p.analysis_basis AS "analysisBasis", p.oxide_entered AS "oxideEntered",
  p.active_ingredients AS "activeIngredients", p.registration_number AS "registrationNumber", p.epa_approval AS "epaApproval",
  p.label_url AS "labelUrl", p.sds_url AS "sdsUrl", p.source_url AS "sourceUrl", p.source_note AS "sourceNote",
  p.verified_on::text AS "verifiedOn", p.verification, p.aliases, p.blend, p.notes, p.version, p.archived_at AS "archivedAt",
  p.default_rate::float AS "defaultRate", p.rate_unit AS "rateUnit", p.withholding_days AS "withholdingDays"`;

export async function searchCatalogue(farmId: string, opts: { kind: string; q?: string; limit?: number; includeArchived?: boolean }) {
  const q = (opts.q ?? '').trim().toLowerCase();
  const like = `%${q}%`;
  return rowsOf(await db.execute(sql`
    SELECT ${COLUMNS}, pr.favourite, pr.nickname, pr.last_used_at AS "lastUsedAt",
      CASE WHEN ${q} = '' THEN 0
           WHEN lower(p.name) = ${q} OR lower(COALESCE(pr.nickname, '')) = ${q} THEN 1
           WHEN lower(p.name) LIKE ${q + '%'} OR lower(COALESCE(pr.nickname, '')) LIKE ${q + '%'} THEN 2
           ELSE 3 END AS rank
    FROM input_products p
    LEFT JOIN farm_product_prefs pr ON pr.product_id = p.id AND pr.farm_id = ${farmId}
    WHERE (p.farm_id IS NULL OR p.farm_id = ${farmId}) AND p.kind = ${opts.kind}
      AND (${opts.includeArchived ?? false} OR p.archived_at IS NULL)
      AND (${q} = '' OR lower(p.name) LIKE ${like} OR lower(COALESCE(p.supplier, '')) LIKE ${like}
           OR lower(COALESCE(p.category, '')) LIKE ${like} OR lower(COALESCE(p.registration_number, '')) LIKE ${like}
           OR lower(COALESCE(p.active_ingredients::text, '')) LIKE ${like} OR lower(COALESCE(p.active_ingredient, '')) LIKE ${like}
           OR lower(array_to_string(p.aliases, ' ')) LIKE ${like} OR lower(COALESCE(pr.nickname, '')) LIKE ${like})
    ORDER BY COALESCE(pr.favourite, false) DESC, rank, pr.last_used_at DESC NULLS LAST, p.name
    LIMIT ${Math.min(opts.limit ?? 50, 200)}`));
}

export async function getProduct(farmId: string, id: string) {
  const [p] = rowsOf(await db.execute(sql`
    SELECT ${COLUMNS}, pr.favourite, pr.nickname FROM input_products p
    LEFT JOIN farm_product_prefs pr ON pr.product_id = p.id AND pr.farm_id = ${farmId}
    WHERE p.id = ${id} AND (p.farm_id IS NULL OR p.farm_id = ${farmId})`));
  if (!p) throw new MapError('Product not found', 404);
  return p;
}

export async function catalogueSources() {
  return rowsOf(await db.execute(sql`SELECT id, name, url, coverage, retrieved_on::text AS "retrievedOn", notes FROM catalogue_sources ORDER BY name`));
}

export interface ProductInput {
  kind: string;
  name: string;
  supplier?: string | null;
  category?: string | null;
  formulation?: string | null;
  units?: string[];
  // Nutrient % as on the label; basis says whether they're elemental or oxide (P2O5, K2O...)
  analysis?: Nutrients & { basis: 'elemental' | 'oxide' };
  activeIngredients?: { name: string; concentration?: number | null; unit?: string | null }[];
  registrationNumber?: string | null;
  epaApproval?: string | null;
  labelUrl?: string | null;
  sdsUrl?: string | null;
  notes?: string | null;
  // A blend of catalogue products, by percentage of the mix
  blend?: { productId: string; percent: number }[];
  nickname?: string | null;
}

async function blendAnalysis(tx: any, farmId: string, parts: { productId: string; percent: number }[]) {
  const total = parts.reduce((s, p) => s + p.percent, 0);
  if (Math.abs(total - 100) > 0.5) throw new MapError(`The blend adds up to ${total}%. It needs to total 100%.`);
  const result: Record<string, number> = { N: 0, P: 0, K: 0, S: 0, Mg: 0, Ca: 0 };
  const ingredients: any[] = [];
  let unknown = false;
  for (const part of parts) {
    const [p] = rowsOf(await tx.execute(sql`
      SELECT id, name, verification, n_percent, p_percent, k_percent, s_percent, mg_percent, ca_percent FROM input_products
      WHERE id = ${part.productId} AND (farm_id IS NULL OR farm_id = ${farmId})`));
    if (!p) throw new MapError('A blend ingredient was not found');
    ingredients.push({ productId: p.id, name: p.name, percent: part.percent, verification: p.verification });
    const vals = { N: p.n_percent, P: p.p_percent, K: p.k_percent, S: p.s_percent, Mg: p.mg_percent, Ca: p.ca_percent };
    for (const k of NUTRIENTS) {
      if (vals[k] == null) unknown = true;
      else result[k] += Number(vals[k]) * part.percent / 100;
    }
  }
  // Unknown stays unknown: if an ingredient's analysis is missing, so is the blend's
  const analysis = unknown ? null : Object.fromEntries(NUTRIENTS.map(k => [k, Math.round(result[k] * 1000) / 1000]));
  return { ingredients, analysis };
}

function elemental(analysis?: ProductInput['analysis']) {
  if (!analysis) return { values: null as Nutrients | null, basis: 'elemental', oxide: null as any };
  if (analysis.basis === 'oxide') {
    const values: Nutrients = { N: analysis.N ?? null };
    for (const k of ['P', 'K', 'S', 'Mg', 'Ca'] as const) {
      values[k] = analysis[k] == null ? null : Math.round(Number(analysis[k]) * OXIDE_TO_ELEMENT[k] * 1000) / 1000;
    }
    return { values, basis: 'oxide_converted', oxide: analysis };
  }
  return { values: analysis as Nutrients, basis: 'elemental', oxide: null };
}

async function saveVersion(tx: any, id: string, userId: string) {
  await tx.execute(sql`
    INSERT INTO product_versions (product_id, version, data, created_by)
    SELECT id, version, to_jsonb(input_products.*), ${userId} FROM input_products WHERE id = ${id}
    ON CONFLICT (product_id, version) DO NOTHING`);
}

/**
 * A product added by the farm. It's marked farm-entered: usable in records straight away,
 * without claiming its label details have been checked.
 */
export async function createCustomProduct(farmId: string, userId: string, input: ProductInput) {
  return db.transaction(async tx => {
    let { values, basis, oxide } = elemental(input.analysis);
    let blend: any = null;
    if (input.blend?.length) {
      const b = await blendAnalysis(tx, farmId, input.blend);
      blend = b.ingredients;
      values = b.analysis;
      basis = 'blend';
    }
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO input_products (farm_id, kind, name, supplier, category, formulation, units,
        n_percent, p_percent, k_percent, s_percent, mg_percent, ca_percent, analysis_basis, oxide_entered,
        active_ingredients, registration_number, epa_approval, label_url, sds_url, notes, blend, verification, created_by)
      VALUES (${farmId}, ${input.kind}, ${input.name}, ${input.supplier ?? null}, ${input.blend?.length ? 'blend' : input.category ?? null},
        ${input.formulation ?? null}, ${sql`ARRAY[${sql.join((input.units?.length ? input.units : ['kg/ha', 't/ha']).map(u => sql`${u}`), sql`, `)}]::text[]`},
        ${values?.N ?? null}, ${values?.P ?? null}, ${values?.K ?? null}, ${values?.S ?? null}, ${values?.Mg ?? null}, ${values?.Ca ?? null},
        ${basis}, ${oxide ? JSON.stringify(oxide) : null}::jsonb,
        ${input.activeIngredients?.length ? JSON.stringify(input.activeIngredients) : null}::jsonb,
        ${input.registrationNumber ?? null}, ${input.epaApproval ?? null}, ${input.labelUrl ?? null}, ${input.sdsUrl ?? null},
        ${input.notes ?? null}, ${blend ? JSON.stringify(blend) : null}::jsonb, 'farm_entered', ${userId})
      RETURNING id`));
    await saveVersion(tx, row.id, userId);
    if (input.nickname) {
      await tx.execute(sql`
        INSERT INTO farm_product_prefs (farm_id, product_id, nickname) VALUES (${farmId}, ${row.id}, ${input.nickname})
        ON CONFLICT (farm_id, product_id) DO UPDATE SET nickname = EXCLUDED.nickname`);
    }
    return { id: row.id as string };
  });
}

/**
 * Change a farm's own product. The old details are kept as a version; jobs keep what they saved.
 */
export async function updateCustomProduct(farmId: string, userId: string, id: string, input: Partial<ProductInput>) {
  return db.transaction(async tx => {
    const [cur] = rowsOf(await tx.execute(sql`SELECT * FROM input_products WHERE id = ${id}`));
    if (!cur || cur.farm_id !== farmId) throw new MapError('Only your farm\'s own products can be changed here', 403);
    await saveVersion(tx, id, userId);
    const analysis = input.analysis ? elemental(input.analysis) : null;
    await tx.execute(sql`
      UPDATE input_products SET
        name = ${input.name ?? cur.name}, supplier = ${input.supplier !== undefined ? input.supplier : cur.supplier},
        category = ${input.category !== undefined ? input.category : cur.category},
        formulation = ${input.formulation !== undefined ? input.formulation : cur.formulation},
        n_percent = ${analysis ? analysis.values?.N ?? null : cur.n_percent}, p_percent = ${analysis ? analysis.values?.P ?? null : cur.p_percent},
        k_percent = ${analysis ? analysis.values?.K ?? null : cur.k_percent}, s_percent = ${analysis ? analysis.values?.S ?? null : cur.s_percent},
        mg_percent = ${analysis ? analysis.values?.Mg ?? null : cur.mg_percent}, ca_percent = ${analysis ? analysis.values?.Ca ?? null : cur.ca_percent},
        analysis_basis = ${analysis ? analysis.basis : cur.analysis_basis},
        oxide_entered = ${analysis ? (analysis.oxide ? JSON.stringify(analysis.oxide) : null) : (cur.oxide_entered ? JSON.stringify(cur.oxide_entered) : null)}::jsonb,
        active_ingredients = ${input.activeIngredients ? JSON.stringify(input.activeIngredients) : (cur.active_ingredients ? JSON.stringify(cur.active_ingredients) : null)}::jsonb,
        registration_number = ${input.registrationNumber !== undefined ? input.registrationNumber : cur.registration_number},
        label_url = ${input.labelUrl !== undefined ? input.labelUrl : cur.label_url},
        sds_url = ${input.sdsUrl !== undefined ? input.sdsUrl : cur.sds_url},
        notes = ${input.notes !== undefined ? input.notes : cur.notes},
        version = version + 1, updated_at = now()
      WHERE id = ${id}`);
    await saveVersion(tx, id, userId);
  });
}

/**
 * Products used in records are archived, never deleted
 */
/**
 * A manager checks one of the farm's own products against its label or analysis sheet. It then
 * counts as verified (nutrients included), with who checked it, when and against what. Shared
 * catalogue products are verified from their source and can't be changed here.
 */
export async function verifyFarmProduct(farmId: string, userId: string, id: string, input: { reference: string; labelUrl?: string | null }) {
  await db.transaction(async tx => {
    const [p] = rowsOf(await tx.execute(sql`SELECT id, farm_id, verification FROM input_products WHERE id = ${id} AND archived_at IS NULL`));
    if (!p || (p.farm_id && p.farm_id !== farmId)) throw new MapError('Product not found', 404);
    if (!p.farm_id) throw new MapError('Shared catalogue products are checked from their published source, not here', 403);
    await saveVersion(tx, id, userId);
    const [u] = rowsOf(await tx.execute(sql`SELECT name FROM users WHERE id = ${userId}`));
    await tx.execute(sql`
      UPDATE input_products SET verification = 'verified', verified_on = CURRENT_DATE, checked_by = ${userId}, checked_at = now(),
        check_reference = ${input.reference}, label_url = COALESCE(${input.labelUrl ?? null}, label_url),
        source_note = ${`Checked on the farm by ${u?.name ?? 'a manager'} against: ${input.reference}`},
        version = version + 1, updated_at = now()
      WHERE id = ${id}`);
    await saveVersion(tx, id, userId);
  });
  return getProduct(farmId, id);
}

export async function archiveCustomProduct(farmId: string, id: string) {
  const rows = rowsOf(await db.execute(sql`
    UPDATE input_products SET archived_at = now() WHERE id = ${id} AND farm_id = ${farmId} AND archived_at IS NULL RETURNING id`));
  if (rows.length === 0) throw new MapError('Only your farm\'s own products can be archived', 403);
}

export async function setProductPref(farmId: string, productId: string, input: { favourite?: boolean; nickname?: string | null }) {
  await getProduct(farmId, productId);
  await db.execute(sql`
    INSERT INTO farm_product_prefs (farm_id, product_id, favourite, nickname)
    VALUES (${farmId}, ${productId}, ${input.favourite ?? false}, ${input.nickname ?? null})
    ON CONFLICT (farm_id, product_id) DO UPDATE SET
      favourite = COALESCE(${input.favourite ?? null}, farm_product_prefs.favourite),
      nickname = CASE WHEN ${input.nickname !== undefined} THEN ${input.nickname ?? null} ELSE farm_product_prefs.nickname END`);
}

export async function touchProduct(exec: any, farmId: string, productId: string) {
  await exec.execute(sql`
    INSERT INTO farm_product_prefs (farm_id, product_id, last_used_at) VALUES (${farmId}, ${productId}, now())
    ON CONFLICT (farm_id, product_id) DO UPDATE SET last_used_at = now()`);
}

/**
 * What a job saves about the product it used, so later catalogue edits don't change it
 */
export async function productSnapshot(exec: any, farmId: string, productId: string) {
  const [p] = rowsOf(await exec.execute(sql`
    SELECT ${COLUMNS} FROM input_products p WHERE p.id = ${productId} AND (p.farm_id IS NULL OR p.farm_id = ${farmId})`));
  if (!p) throw new MapError('That product was not found');
  return {
    id: p.id, name: p.name, supplier: p.supplier, category: p.category, version: p.version, verification: p.verification,
    verifiedOn: p.verifiedOn, sourceUrl: p.sourceUrl, analysisBasis: p.analysisBasis,
    analysis: Object.fromEntries(NUTRIENTS.map(k => [k, p[k]])),
    blend: p.blend, registrationNumber: p.registrationNumber, activeIngredients: p.activeIngredients,
    formulation: p.formulation, labelUrl: p.labelUrl, sdsUrl: p.sdsUrl,
  };
}
