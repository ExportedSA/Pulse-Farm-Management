import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, AlertTriangle, ArrowRight, Download, X, Loader2 } from "lucide-react";

// Comprehensive Minda field mappings - supports both simple and prefixed column names
const MINDA_MAPPINGS: Record<string, string> = {
  // Animal identification
  'Animal ID': 'cowId', 'AnimalID': 'cowId', 'Cow ID': 'cowId', 'Animal-Animal ID': 'cowId',
  'Visual ID': 'visualId', 'VID': 'visualId', 'Animal-Management Number': 'visualId',
  'Lifetime ID': 'lifetimeId', 'LID': 'lifetimeId', 'Animal-Official ID': 'lifetimeId',
  'NAIT Number': 'naitTag', 'NAIT': 'naitTag', 'Animal-NAIT Number': 'naitTag',
  'EID': 'eid', 'Animal-EID': 'eid',
  'Birth ID': 'birthId', 'Animal-Birth ID': 'birthId',
  'Name': 'name', 'Animal-Name': 'name',
  // Basic info
  'Sex': 'sex', 'Gender': 'sex', 'Animal-Sex': 'sex',
  'Breed': 'breed', 'Animal-Breed': 'breed',
  'Colour': 'color', 'Color': 'color',
  'Date of Birth': 'dateOfBirth', 'DOB': 'dateOfBirth', 'Birth Date': 'dateOfBirth', 'Animal-Birth Date': 'dateOfBirth',
  'Date Entered Herd': 'purchaseDate', 'Animal-Start Date': 'purchaseDate',
  'Status': 'status', 'Animal-Milk Status': 'milkStatus',
  'Animal-A2 Status': 'a2Status', 'Animal-Age (Years)': 'ageYears',
  'Animal-BVD Status': 'bvdStatus', 'Animal-BVD Test Date': 'bvdTestDate',
  'Animal-DNA Profile': 'dnaProfile', 'Animal-Pedigree Indicator': 'pedigreeIndicator',
  'Animal-Removal Fate': 'removalFate', 'Animal-Removal Reason': 'removalReason',
  'Animal-Date Removed': 'dateRemoved', 'Animal-Year Born': 'yearBorn',
  // Dam info
  'Dam ID': 'damId', 'Dam': 'damId', 'Dam-Official ID': 'damId',
  'Dam-Breed': 'damBreed', 'Dam-Management Number': 'damManagementNumber',
  'Dam-Dam BW-Value': 'damBW', 'Dam-Dam PW-Value': 'damPW', 'Dam-Dam LW-Value': 'damLW',
  // Sire info
  'Sire ID': 'sireId', 'Sire': 'sireId', 'Sire-Sire ID': 'sireId',
  'Sire Code': 'sireCode', 'Sire Name': 'sireName', 'Sire-Name': 'sireName',
  'Sire-Breed': 'sireBreed', 'Sire-Sire BW-Value': 'sireBW', 'Sire-Sire Parentage': 'sireParentage',
  // Breeding values
  'BW': 'breedingWorth', 'Breeding Worth': 'breedingWorth', 'Animal-BW-Value': 'breedingWorth',
  'Animal-BW-Reliability': 'bwReliability',
  'PW': 'productionWorth', 'Production Worth': 'productionWorth', 'Animal-PW-Value': 'productionWorth',
  'Animal-PW-Reliability': 'pwReliability',
  'LW': 'lactationWorth', 'Animal-LW': 'lactationWorth',
  'Reliability': 'reliability',
  // Detailed breeding values
  'Breeding Values-Fat (kg)-Value': 'fatBV', 'Breeding Values-Fat (kg)-Reliability': 'fatBVReliability',
  'Breeding Values-Protein (kg)-Value': 'proteinBV', 'Breeding Values-Protein (kg)-Reliability': 'proteinBVReliability',
  'Breeding Values-Milk (ltr)-Value': 'milkBV', 'Breeding Values-Milk (ltr)-Reliability': 'milkBVReliability',
  'Breeding Values-Fertility (%)-Value': 'fertilityBV', 'Breeding Values-Fertility (%)-Reliability': 'fertilityBVReliability',
  'Breeding Values-Somatic Cell-Value': 'sccBV', 'Breeding Values-Somatic Cell-Reliability': 'sccBVReliability',
  'Breeding Values-Liveweight (kg)-Value': 'liveweightBV', 'Breeding Values-Liveweight (kg)-Reliability': 'liveweightBVReliability',
  'Breeding Values-Functional Survival (%)-Value': 'survivalBV', 'Breeding Values-Functional Survival (%)-Reliability': 'survivalBVReliability',
  'Breeding Values-Gestation Length (days)-Value': 'gestationBV', 'Breeding Values-Gestation Length (days)-Reliability': 'gestationBVReliability',
  'Breeding Values-Calving Difficulty-Value': 'calvingDifficultyBV', 'Breeding Values-Calving Difficulty-Reliability': 'calvingDifficultyBVReliability',
  'Breeding Values-Body Condition Score-Value': 'bcsBV', 'Breeding Values-Body Condition Score-Reliability': 'bcsBVReliability',
  'Breeding Values-Stature-Value': 'statureBV', 'Breeding Values-Capacity-Value': 'capacityBV',
  'Breeding Values-Rump angle-Value': 'rumpAngleBV', 'Breeding Values-Rump width-Value': 'rumpWidthBV',
  'Breeding Values-Rear leg set-Value': 'rearLegBV', 'Breeding Values-Udder Overall-Value': 'udderOverallBV',
  'Breeding Values-Udder support-Value': 'udderSupportBV', 'Breeding Values-Fore udder-Value': 'foreUdderBV',
  'Breeding Values-Rear udder-Value': 'rearUdderBV', 'Breeding Values-Front teat placement-Value': 'frontTeatBV',
  'Breeding Values-Rear teat placement-Value': 'rearTeatBV', 'Breeding Values-Teat Length-Value': 'teatLengthBV',
  'Breeding Values-Dairy conformation-Value': 'dairyConformationBV',
  'Breeding Values-Milking speed-Value': 'milkingSpeedBV', 'Breeding Values-Adaptability to milking-Value': 'adaptabilityBV',
  'Breeding Values-Shed temperament-Value': 'temperamentBV', 'Breeding Values-Overall opinion-Value': 'overallOpinionBV',
  // Reproduction / Mating
  'Mating Date': 'lastMatingDate', 'Last Mating': 'lastMatingDate', 'Mating-Mating Date': 'lastMatingDate',
  'Mating Sire': 'matingSire', 'Mating-Sire ID': 'matingSire',
  'Due Date': 'dueDate', 'Expected Calving': 'dueDate', 'Pre-Calving-Expected Calving Date': 'dueDate',
  'In Calf': 'inCalf', 'Pregnancy Status': 'pregnancyStatus', 'Mating-Pregnancy Diagnosis': 'pregnancyStatus',
  'Mating-Days Pregnant': 'daysPregnant', 'Mating-Expected Mating Date': 'expectedMatingDate',
  'Mating-Heat Date': 'heatDate', 'Mating-Mating Type': 'matingType',
  'Mating-Non-Cycling': 'nonCycling', 'Mating-At Risk Cow': 'atRiskCow',
  'Mating-Charge Type': 'chargeType', 'Mating-Foetal Count': 'foetalCount',
  'Lactation Number': 'lactationNumber', 'Parity': 'lactationNumber',
  'Calving Ease': 'calvingEase', 'Calf-Assistance Level': 'calvingAssistance',
  'Dry Off Date': 'dryOffDate', 'Lactation-Dry Off Date': 'dryOffDate',
  'Animal-Calving Date': 'calvingDate',
  // Calf info
  'Calf-Birth ID': 'calfBirthId', 'Calf-Birth Date': 'calfBirthDate', 'Calf-Sex': 'calfSex',
  'Calf-Breed': 'calfBreed', 'Calf-BW-Value': 'calfBW', 'Calf-Calf Fate': 'calfFate',
  'Calf-Calving Comments': 'calvingComments', 'Calf-Termination Reason': 'calfTerminationReason',
  // Pre-calving
  'Pre-Calving-Expected Calf BW-Value': 'expectedCalfBW', 'Pre-Calving-Expected Calf Sire ID': 'expectedCalfSireId',
  // Lactation / Production
  'Milk kgMS': 'milkKgMS', 'Milk Solids': 'milkKgMS', 'Lactation-Solids (kg)': 'milkKgMS',
  'Fat kg': 'fatKg', 'Lactation-Fat (kg)': 'fatKg',
  'Protein kg': 'proteinKg', 'Lactation-Prt (kg)': 'proteinKg',
  'Fat %': 'fatPercent', 'Lactation-Fat (%)': 'fatPercent',
  'Protein %': 'proteinPercent', 'Lactation-Prt (%)': 'proteinPercent',
  'Days in Milk': 'daysInMilk', 'DIM': 'daysInMilk', 'Lactation-Days in Milk': 'daysInMilk',
  'Lactation-Milk (l)': 'milkLitres', 'Lactation-Start Date': 'lactationStartDate',
  'Lactation-Days Lactating': 'daysLactating',
  // Herd test results
  'Herd Test Results-Date': 'herdTestDate', 'Herd Test Results-Milk Total (l)': 'herdTestMilk',
  'Herd Test Results-Fat (%)': 'herdTestFatPercent', 'Herd Test Results-Fat (kg)': 'herdTestFatKg',
  'Herd Test Results-Protein (%)': 'herdTestProteinPercent', 'Herd Test Results-Protein (kg)': 'herdTestProteinKg',
  'Herd Test Results-Milk Solids (kg)': 'herdTestMS', 'Herd Test Results-SCC (000)': 'herdTestSCC',
  'Herd Test Results-Assessment': 'herdTestAssessment', 'Herd Test Results-Abnormal Code': 'herdTestAbnormalCode',
  // Health
  'SCC': 'somaticCellCount', 'Somatic Cell Count': 'somaticCellCount',
  'BCS': 'bodyConditionScore', 'Body Condition': 'bodyConditionScore', 'Animal-BCS': 'bodyConditionScore',
  'Animal-BCS Date': 'bcsDate',
  'Mastitis Count': 'mastitisCount', 'Health-Mastitis Cases': 'mastitisCount',
  'Lameness Score': 'lamenessScore', 'Health-Lameness Cases': 'lamenessCount',
  'Health-Condition': 'healthCondition', 'Health-Condition Category': 'healthConditionCategory',
  'Health-Event Date': 'healthEventDate', 'Health-Date Separated': 'healthDateSeparated',
  'Health-Treatment': 'healthTreatment', 'Health-Product Category': 'healthProductCategory',
  'Health-Dose Amount': 'healthDoseAmount', 'Health-Dose Unit': 'healthDoseUnit',
  'Health-No. of Doses': 'healthDoseCount', 'Health-Quarters': 'healthQuarters',
  'Health-Meat W/H days': 'meatWithholdDays', 'Health-Milk W/H hours': 'milkWithholdHours',
  'Health-RTV': 'healthRTV', 'Health-Last Treatment Date': 'lastTreatmentDate',
  'Health-Vet Name': 'vetName',
  // Weight
  'Live Weight': 'liveWeight', 'Liveweight': 'liveWeight', 'Weight': 'liveWeight',
  'Animal-Liveweight': 'liveWeight', 'Animal-Liveweight Aggregated': 'liveWeightAggregated',
  'Animal-Liveweight Date': 'liveWeightDate',
  'Birth Weight': 'birthWeight', 'Weaning Weight': 'weaningWeight', 'ADG': 'averageDailyGain',
  // Location
  'Mob': 'currentMob', 'Current Mob': 'currentMob', 'Animal-NAIT Description': 'naitDescription',
  'Paddock': 'currentPaddock',
  // Financial
  'Purchase Price': 'purchasePrice',
  // Other
  'Notes': 'notes', 'Comments': 'notes',
  'Friesian %': 'friesianPercent', 'Jersey %': 'jerseyPercent',
  'Animal-AHB ID': 'ahbId',
};

const PULSE_FIELDS = [
  // Identification
  { key: 'cowId', label: 'Cow ID', cat: 'ID' }, { key: 'visualId', label: 'Visual ID', cat: 'ID' },
  { key: 'lifetimeId', label: 'Lifetime ID', cat: 'ID' }, { key: 'naitTag', label: 'NAIT Tag', cat: 'ID' },
  { key: 'eid', label: 'EID', cat: 'ID' }, { key: 'birthId', label: 'Birth ID', cat: 'ID' },
  { key: 'ahbId', label: 'AHB ID', cat: 'ID' },
  // Basic info
  { key: 'name', label: 'Name', cat: 'Basic' }, { key: 'sex', label: 'Sex', cat: 'Basic', required: true },
  { key: 'breed', label: 'Breed', cat: 'Basic' }, { key: 'color', label: 'Color', cat: 'Basic' },
  { key: 'dateOfBirth', label: 'Date of Birth', cat: 'Basic' }, { key: 'yearBorn', label: 'Year Born', cat: 'Basic' },
  { key: 'ageYears', label: 'Age (Years)', cat: 'Basic' },
  { key: 'purchaseDate', label: 'Start Date', cat: 'Basic' }, { key: 'dateRemoved', label: 'Date Removed', cat: 'Basic' },
  { key: 'milkStatus', label: 'Milk Status', cat: 'Basic' }, { key: 'a2Status', label: 'A2 Status', cat: 'Basic' },
  { key: 'bvdStatus', label: 'BVD Status', cat: 'Basic' }, { key: 'dnaProfile', label: 'DNA Profile', cat: 'Basic' },
  { key: 'removalFate', label: 'Removal Fate', cat: 'Basic' }, { key: 'removalReason', label: 'Removal Reason', cat: 'Basic' },
  // Genetics / Parentage
  { key: 'damId', label: 'Dam ID', cat: 'Genetics' }, { key: 'damBreed', label: 'Dam Breed', cat: 'Genetics' },
  { key: 'damManagementNumber', label: 'Dam Mgmt #', cat: 'Genetics' },
  { key: 'damBW', label: 'Dam BW', cat: 'Genetics' }, { key: 'damPW', label: 'Dam PW', cat: 'Genetics' },
  { key: 'sireId', label: 'Sire ID', cat: 'Genetics' }, { key: 'sireName', label: 'Sire Name', cat: 'Genetics' },
  { key: 'sireBreed', label: 'Sire Breed', cat: 'Genetics' }, { key: 'sireBW', label: 'Sire BW', cat: 'Genetics' },
  // Breeding Values
  { key: 'breedingWorth', label: 'BW', cat: 'BV' }, { key: 'bwReliability', label: 'BW Rel', cat: 'BV' },
  { key: 'productionWorth', label: 'PW', cat: 'BV' }, { key: 'pwReliability', label: 'PW Rel', cat: 'BV' },
  { key: 'lactationWorth', label: 'LW', cat: 'BV' },
  { key: 'milkBV', label: 'Milk BV', cat: 'BV' }, { key: 'fatBV', label: 'Fat BV', cat: 'BV' },
  { key: 'proteinBV', label: 'Protein BV', cat: 'BV' }, { key: 'fertilityBV', label: 'Fertility BV', cat: 'BV' },
  { key: 'sccBV', label: 'SCC BV', cat: 'BV' }, { key: 'liveweightBV', label: 'Liveweight BV', cat: 'BV' },
  { key: 'survivalBV', label: 'Survival BV', cat: 'BV' }, { key: 'gestationBV', label: 'Gestation BV', cat: 'BV' },
  { key: 'calvingDifficultyBV', label: 'Calving Diff BV', cat: 'BV' }, { key: 'bcsBV', label: 'BCS BV', cat: 'BV' },
  // Reproduction / Mating
  { key: 'lastMatingDate', label: 'Mating Date', cat: 'Repro' }, { key: 'matingSire', label: 'Mating Sire', cat: 'Repro' },
  { key: 'matingType', label: 'Mating Type', cat: 'Repro' }, { key: 'heatDate', label: 'Heat Date', cat: 'Repro' },
  { key: 'dueDate', label: 'Due Date', cat: 'Repro' }, { key: 'daysPregnant', label: 'Days Pregnant', cat: 'Repro' },
  { key: 'pregnancyStatus', label: 'Pregnancy Status', cat: 'Repro' }, { key: 'foetalCount', label: 'Foetal Count', cat: 'Repro' },
  { key: 'calvingDate', label: 'Calving Date', cat: 'Repro' }, { key: 'calvingAssistance', label: 'Calving Assist', cat: 'Repro' },
  { key: 'lactationNumber', label: 'Lactation #', cat: 'Repro' }, { key: 'dryOffDate', label: 'Dry Off Date', cat: 'Repro' },
  { key: 'atRiskCow', label: 'At Risk', cat: 'Repro' }, { key: 'nonCycling', label: 'Non-Cycling', cat: 'Repro' },
  // Calf info
  { key: 'calfBirthId', label: 'Calf Birth ID', cat: 'Calf' }, { key: 'calfBirthDate', label: 'Calf Birth Date', cat: 'Calf' },
  { key: 'calfSex', label: 'Calf Sex', cat: 'Calf' }, { key: 'calfBreed', label: 'Calf Breed', cat: 'Calf' },
  { key: 'calfBW', label: 'Calf BW', cat: 'Calf' }, { key: 'calfFate', label: 'Calf Fate', cat: 'Calf' },
  // Production / Lactation
  { key: 'milkKgMS', label: 'Milk kgMS', cat: 'Prod' }, { key: 'milkLitres', label: 'Milk (L)', cat: 'Prod' },
  { key: 'fatKg', label: 'Fat kg', cat: 'Prod' }, { key: 'fatPercent', label: 'Fat %', cat: 'Prod' },
  { key: 'proteinKg', label: 'Protein kg', cat: 'Prod' }, { key: 'proteinPercent', label: 'Protein %', cat: 'Prod' },
  { key: 'daysInMilk', label: 'Days in Milk', cat: 'Prod' }, { key: 'daysLactating', label: 'Days Lactating', cat: 'Prod' },
  { key: 'lactationStartDate', label: 'Lactation Start', cat: 'Prod' },
  // Herd Test
  { key: 'herdTestDate', label: 'Herd Test Date', cat: 'Test' }, { key: 'herdTestMilk', label: 'Test Milk (L)', cat: 'Test' },
  { key: 'herdTestMS', label: 'Test MS (kg)', cat: 'Test' }, { key: 'herdTestSCC', label: 'Test SCC', cat: 'Test' },
  { key: 'herdTestFatPercent', label: 'Test Fat %', cat: 'Test' }, { key: 'herdTestProteinPercent', label: 'Test Prt %', cat: 'Test' },
  // Health
  { key: 'bodyConditionScore', label: 'BCS', cat: 'Health' }, { key: 'bcsDate', label: 'BCS Date', cat: 'Health' },
  { key: 'somaticCellCount', label: 'SCC', cat: 'Health' },
  { key: 'mastitisCount', label: 'Mastitis Cases', cat: 'Health' }, { key: 'lamenessCount', label: 'Lameness Cases', cat: 'Health' },
  { key: 'healthCondition', label: 'Condition', cat: 'Health' }, { key: 'healthConditionCategory', label: 'Condition Cat', cat: 'Health' },
  { key: 'healthTreatment', label: 'Treatment', cat: 'Health' }, { key: 'healthEventDate', label: 'Event Date', cat: 'Health' },
  { key: 'healthDoseAmount', label: 'Dose Amount', cat: 'Health' }, { key: 'healthDoseUnit', label: 'Dose Unit', cat: 'Health' },
  { key: 'meatWithholdDays', label: 'Meat W/H Days', cat: 'Health' }, { key: 'milkWithholdHours', label: 'Milk W/H Hrs', cat: 'Health' },
  { key: 'vetName', label: 'Vet Name', cat: 'Health' },
  // Weight
  { key: 'liveWeight', label: 'Live Weight', cat: 'Weight' }, { key: 'liveWeightDate', label: 'Weight Date', cat: 'Weight' },
  { key: 'birthWeight', label: 'Birth Weight', cat: 'Weight' }, { key: 'weaningWeight', label: 'Weaning Weight', cat: 'Weight' },
  // Location
  { key: 'naitDescription', label: 'NAIT Location', cat: 'Location' }, { key: 'currentPaddock', label: 'Paddock', cat: 'Location' },
  // Financial
  { key: 'purchasePrice', label: 'Purchase Price', cat: 'Financial' },
  // Other
  { key: 'notes', label: 'Notes', cat: 'Other' },
];

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [] as string[], rows: [] as string[][] };
  const parse = (line: string) => {
    const r: string[] = []; let c = '', q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { r.push(c.trim()); c = ''; } else c += ch; }
    r.push(c.trim()); return r;
  };
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse).filter(r => r.some(c => c)) };
}

const MONTHS: Record<string, string> = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
  'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
};

function normalizeValue(val: string, key: string): any {
  if (!val?.trim()) return null;
  const v = val.trim(), l = v.toLowerCase();
  if (key === 'sex') return ['f','female','cow','heifer'].includes(l) ? 'female' : ['m','male','bull','steer'].includes(l) ? 'male' : v;
  if (key === 'status' || key === 'milkStatus') {
    if (['active','alive','present','in milk','in-milk'].includes(l)) return 'active';
    if (['sold','gone'].includes(l)) return 'sold';
    if (['dead','deceased'].includes(l)) return 'deceased';
    if (['dry','dried off'].includes(l)) return 'dry';
    return v;
  }
  if (key === 'inCalf' || key === 'atRiskCow' || key === 'nonCycling') return ['yes','y','1','true'].includes(l);
  // Date parsing - multiple formats
  if (key.includes('Date') || key === 'dateOfBirth' || key === 'dueDate' || key === 'calvingDate' || key === 'heatDate') {
    // DD/MM/YYYY format
    let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // DD Mon YYYY format (e.g., "31 Jul 2019")
    m = v.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (m) {
      const month = MONTHS[m[2].toLowerCase()];
      if (month) return `${m[3]}-${month}-${m[1].padStart(2,'0')}`;
    }
    // YYYY-MM-DD format (already correct)
    if (v.match(/^\d{4}-\d{2}-\d{2}$/)) return v;
    return null;
  }
  // Numeric fields
  const nums = [
    'breedingWorth','productionWorth','lactationWorth','reliability','bwReliability','pwReliability',
    'milkBV','fatBV','proteinBV','fertilityBV','sccBV','liveweightBV','survivalBV','gestationBV',
    'calvingDifficultyBV','bcsBV','statureBV','capacityBV','rumpAngleBV','rumpWidthBV','rearLegBV',
    'udderOverallBV','udderSupportBV','foreUdderBV','rearUdderBV','frontTeatBV','rearTeatBV','teatLengthBV',
    'dairyConformationBV','milkingSpeedBV','adaptabilityBV','temperamentBV','overallOpinionBV',
    'damBW','damPW','damLW','sireBW','calfBW','expectedCalfBW',
    'milkKgMS','fatKg','proteinKg','fatPercent','proteinPercent','milkLitres',
    'herdTestMilk','herdTestFatPercent','herdTestFatKg','herdTestProteinPercent','herdTestProteinKg','herdTestMS','herdTestSCC',
    'somaticCellCount','bodyConditionScore','mastitisCount','lamenessCount',
    'healthDoseAmount','healthDoseCount','meatWithholdDays','milkWithholdHours',
    'liveWeight','liveWeightAggregated','birthWeight','weaningWeight','averageDailyGain',
    'lactationNumber','daysInMilk','daysLactating','daysPregnant','foetalCount','ageYears',
    'friesianPercent','jerseyPercent','purchasePrice'
  ];
  if (nums.includes(key)) { const n = parseFloat(v.replace(/[$,]/g,'')); return isNaN(n) ? null : n; }
  return v;
}

interface ParsedRow { idx: number; mapped: Record<string, any>; errors: string[]; warnings: string[]; }

export default function CSVImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing' | 'done'>('upload');
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ animals: 0, health: 0, repro: 0, weight: 0, prod: 0 });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const qc = useQueryClient();

  const onDrop = useCallback((files: File[]) => {
    const f = files[0]; if (!f) return;
    setFile(f);
    const r = new FileReader();
    r.onload = e => {
      const d = parseCSV(e.target?.result as string);
      setCsv(d);
      const auto: Record<string, string> = {};
      d.headers.forEach(h => { if (MINDA_MAPPINGS[h]) auto[h] = MINDA_MAPPINGS[h]; });
      setMappings(auto);
      setStep('map');
      toast.success(`Loaded ${d.rows.length} rows`);
    };
    r.readAsText(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1 });

  const processMap = () => {
    if (!csv) return;
    const rows = csv.rows.map((row, i) => {
      const mapped: Record<string, any> = {};
      csv.headers.forEach((h, j) => { const k = mappings[h]; if (k) { const v = normalizeValue(row[j], k); if (v !== null) mapped[k] = v; } });
      const errors: string[] = [], warnings: string[] = [];
      if (!mapped.sex) errors.push('Sex required');
      if (!mapped.cowId && !mapped.naitTag && !mapped.visualId && !mapped.eid) warnings.push('No ID');
      return { idx: i, mapped, errors, warnings };
    });
    setParsed(rows);
    setSelected(new Set(rows.filter(r => !r.errors.length).map(r => r.idx)));
    setStep('preview');
  };

  const importMut = useMutation({
    mutationFn: async (animals: Record<string, any>[]) => {
      const s = { animals: 0, health: 0, repro: 0, weight: 0, prod: 0 };
      for (let i = 0; i < animals.length; i++) {
        const a = animals[i];
        try {
          // Build comprehensive animal payload with all Minda fields
          const animalPayload: Record<string, any> = {
            farmId: '1',
            // Identification
            cowId: a.cowId, visualId: a.visualId, lifetimeId: a.lifetimeId,
            naitTag: a.naitTag, eid: a.eid, birthId: a.birthId, ahbId: a.ahbId,
            // Basic info
            name: a.name, sex: a.sex || 'female', breed: a.breed,
            dateOfBirth: a.dateOfBirth, yearBorn: a.yearBorn,
            status: a.status || 'active', notes: a.notes,
            // Minda status fields
            milkStatus: a.milkStatus, a2Status: a.a2Status,
            bvdStatus: a.bvdStatus, bvdTestDate: a.bvdTestDate,
            dnaProfile: a.dnaProfile, pedigreeIndicator: a.pedigreeIndicator,
            // Removal info
            dateRemoved: a.dateRemoved, removalFate: a.removalFate, removalReason: a.removalReason,
            startDate: a.purchaseDate,
            // Health scores
            bodyConditionScore: a.bodyConditionScore, bcsDate: a.bcsDate,
            liveWeight: a.liveWeight, liveWeightDate: a.liveWeightDate,
            // Location
            naitDescription: a.naitDescription,
          };
          // Dam info
          if (a.damId || a.damBreed || a.damManagementNumber || a.damBW) {
            animalPayload.damInfo = { officialId: a.damId, breed: a.damBreed, managementNumber: a.damManagementNumber, bw: a.damBW, pw: a.damPW, lw: a.damLW };
          }
          // Sire info
          if (a.sireId || a.sireName || a.sireBreed || a.sireBW) {
            animalPayload.sireInfo = { name: a.sireName, breed: a.sireBreed, externalId: a.sireId };
          }
          // Breeding values
          const bvs: Record<string, any> = {};
          if (a.breedingWorth !== undefined) { bvs.bw = a.breedingWorth; bvs.bwReliability = a.bwReliability; }
          if (a.productionWorth !== undefined) { bvs.pw = a.productionWorth; bvs.pwReliability = a.pwReliability; }
          if (a.lactationWorth !== undefined) bvs.lw = a.lactationWorth;
          if (a.milkBV !== undefined) { bvs.milkBV = a.milkBV; bvs.milkBVReliability = a.milkBVReliability; }
          if (a.fatBV !== undefined) { bvs.fatBV = a.fatBV; bvs.fatBVReliability = a.fatBVReliability; }
          if (a.proteinBV !== undefined) { bvs.proteinBV = a.proteinBV; bvs.proteinBVReliability = a.proteinBVReliability; }
          if (a.fertilityBV !== undefined) { bvs.fertilityBV = a.fertilityBV; bvs.fertilityBVReliability = a.fertilityBVReliability; }
          if (a.sccBV !== undefined) { bvs.sccBV = a.sccBV; bvs.sccBVReliability = a.sccBVReliability; }
          if (a.liveweightBV !== undefined) { bvs.liveweightBV = a.liveweightBV; bvs.liveweightBVReliability = a.liveweightBVReliability; }
          if (a.survivalBV !== undefined) { bvs.survivalBV = a.survivalBV; bvs.survivalBVReliability = a.survivalBVReliability; }
          if (a.gestationBV !== undefined) { bvs.gestationBV = a.gestationBV; }
          if (a.calvingDifficultyBV !== undefined) { bvs.calvingDifficultyBV = a.calvingDifficultyBV; }
          if (a.bcsBV !== undefined) { bvs.bcsBV = a.bcsBV; }
          if (a.statureBV !== undefined) bvs.statureBV = a.statureBV;
          if (a.capacityBV !== undefined) bvs.capacityBV = a.capacityBV;
          if (a.udderOverallBV !== undefined) bvs.udderOverallBV = a.udderOverallBV;
          if (a.milkingSpeedBV !== undefined) bvs.milkingSpeedBV = a.milkingSpeedBV;
          if (a.temperamentBV !== undefined) bvs.temperamentBV = a.temperamentBV;
          if (Object.keys(bvs).length > 0) animalPayload.breedingValues = bvs;
          // Lactation info
          if (a.lactationNumber || a.daysInMilk || a.milkKgMS || a.fatKg || a.proteinKg) {
            animalPayload.lactationInfo = {
              lactationNumber: a.lactationNumber, lactationStartDate: a.lactationStartDate,
              daysInMilk: a.daysInMilk, daysLactating: a.daysLactating,
              milkKgMS: a.milkKgMS, milkLitres: a.milkLitres,
              fatKg: a.fatKg, fatPercent: a.fatPercent,
              proteinKg: a.proteinKg, proteinPercent: a.proteinPercent,
              dryOffDate: a.dryOffDate,
            };
          }
          // Reproduction status
          if (a.lastMatingDate || a.pregnancyStatus || a.dueDate || a.calvingDate) {
            animalPayload.reproductionStatus = {
              lastMatingDate: a.lastMatingDate, matingType: a.matingType, matingSire: a.matingSire,
              heatDate: a.heatDate, daysPregnant: a.daysPregnant,
              pregnancyStatus: a.pregnancyStatus, dueDate: a.dueDate, foetalCount: a.foetalCount,
              atRiskCow: a.atRiskCow, nonCycling: a.nonCycling,
              calvingDate: a.calvingDate, calvingAssistance: a.calvingAssistance,
            };
          }
          // Last calf info
          if (a.calfBirthId || a.calfBirthDate || a.calfSex) {
            animalPayload.lastCalfInfo = {
              calfBirthId: a.calfBirthId, calfBirthDate: a.calfBirthDate,
              calfSex: a.calfSex, calfBreed: a.calfBreed, calfBW: a.calfBW, calfFate: a.calfFate,
            };
          }
          // Latest herd test
          if (a.herdTestDate || a.herdTestMilk || a.herdTestSCC) {
            animalPayload.latestHerdTest = {
              testDate: a.herdTestDate, milkTotal: a.herdTestMilk,
              fatPercent: a.herdTestFatPercent, fatKg: a.herdTestFatKg,
              proteinPercent: a.herdTestProteinPercent, proteinKg: a.herdTestProteinKg,
              milkSolidsKg: a.herdTestMS, scc: a.herdTestSCC,
              assessment: a.herdTestAssessment, abnormalCode: a.herdTestAbnormalCode,
            };
          }
          // Health summary
          if (a.mastitisCount || a.lamenessCount || a.healthCondition || a.healthTreatment) {
            animalPayload.healthSummary = {
              mastitisCount: a.mastitisCount, lamenessCount: a.lamenessCount,
              lastCondition: a.healthCondition, lastConditionCategory: a.healthConditionCategory,
              lastTreatment: a.healthTreatment, lastTreatmentDate: a.lastTreatmentDate,
              lastHealthEventDate: a.healthEventDate,
              meatWithholdDays: a.meatWithholdDays, milkWithholdHours: a.milkWithholdHours,
              vetName: a.vetName,
            };
          }
          // Pre-calving info
          if (a.expectedCalfBW || a.expectedCalfSireId) {
            animalPayload.preCalvingInfo = {
              expectedCalfBW: a.expectedCalfBW, expectedCalfSireId: a.expectedCalfSireId,
            };
          }

          const res = await fetch('/api/animals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(animalPayload) });
          if (res.ok) {
            s.animals++;
            const animal = await res.json();
            // Create weight record if liveWeight present
            if (a.liveWeight) {
              await fetch('/api/weight-records', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ animalId: animal.id, weight: a.liveWeight, date: a.liveWeightDate || new Date().toISOString().split('T')[0], recordedBy: '1' })
              }).catch(() => {});
              s.weight++;
            }
            // Create herd test record if present
            if (a.herdTestDate && (a.herdTestMilk || a.herdTestSCC)) {
              await fetch('/api/herd-test-results', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  animalId: animal.id, testDate: a.herdTestDate,
                  milkTotalLitres: a.herdTestMilk, fatPercent: a.herdTestFatPercent, fatKg: a.herdTestFatKg,
                  proteinPercent: a.herdTestProteinPercent, proteinKg: a.herdTestProteinKg,
                  milkSolidsKg: a.herdTestMS, scc: a.herdTestSCC,
                  assessment: a.herdTestAssessment, daysInMilk: a.daysInMilk,
                })
              }).catch(() => {});
              s.prod++;
            }
            // Create reproduction event if mating data present
            if (a.lastMatingDate || a.dueDate) {
              await fetch('/api/reproduction-events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ animalId: animal.id, eventType: a.pregnancyStatus ? 'pregnancy_check' : 'ai',
                  eventDate: a.lastMatingDate || new Date().toISOString().split('T')[0],
                  pregnancyDetails: a.dueDate ? { isPregnant: true, dueDate: a.dueDate, daysPregnant: a.daysPregnant } : undefined,
                })
              }).catch(() => {});
              s.repro++;
            }
            // Create health record if condition present
            if (a.healthCondition || a.healthTreatment) {
              await fetch('/api/health-records', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ animalId: animal.id, recordDate: a.healthEventDate || new Date().toISOString().split('T')[0],
                  somaticCellCount: a.somaticCellCount, bodyConditionScore: a.bodyConditionScore,
                  notes: `${a.healthConditionCategory || ''}: ${a.healthCondition || ''} - ${a.healthTreatment || ''}`.trim(),
                  recordedBy: '1',
                })
              }).catch(() => {});
              s.health++;
            }
          }
        } catch (e) { console.error('Import error:', e); }
        setProgress(Math.round(((i + 1) / animals.length) * 100));
      }
      return s;
    },
    onSuccess: s => { setStats(s); setStep('done'); qc.invalidateQueries({ queryKey: ['/api/animals'] }); toast.success(`Imported ${s.animals} animals!`); },
  });

  const startImport = () => { setStep('importing'); setProgress(0); importMut.mutate(parsed.filter(r => selected.has(r.idx)).map(r => r.mapped)); };
  const reset = () => { setFile(null); setCsv(null); setMappings({}); setParsed([]); setStep('upload'); setProgress(0); setSelected(new Set()); };

  const downloadTemplate = () => {
    const h = ['Animal ID','Visual ID','NAIT Number','Name','Sex','Breed','Date of Birth','Status','Dam ID','Sire ID','BW','PW','Mating Date','Due Date','In Calf','Lactation Number','Milk kgMS','Fat %','Protein %','SCC','BCS','Live Weight','Current Mob','Notes'];
    const s = ['001','V001','982000123456789','Daisy','Female','Friesian','15/08/2020','Active','D045','S123','150','180','15/10/2024','25/07/2025','Yes','3','425','4.8','3.9','120','5.0','485','Milking','Good producer'];
    const blob = new Blob([[h.join(','), s.join(',')].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pulse_import_template.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3"><FileSpreadsheet className="h-8 w-8 text-emerald-600" />Import from Minda / CSV</h1>
        <p className="text-muted-foreground mt-2">Import complete herd data: animals, health, reproduction, genetics, production & weights.</p>
      </div>

      <div className="mb-8 flex items-center gap-4">
        {['Upload', 'Map', 'Preview', 'Import'].map((l, i) => {
          const steps = ['upload', 'map', 'preview', 'importing'];
          const cur = steps.indexOf(step === 'done' ? 'importing' : step);
          return (<div key={l} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= cur ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
              {step === 'done' && i === 3 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`ml-2 ${i <= cur ? 'text-emerald-700 font-medium' : 'text-gray-400'}`}>{l}</span>
            {i < 3 && <ArrowRight className="mx-3 h-4 w-4 text-gray-300" />}
          </div>);
        })}
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader><CardTitle>Upload CSV File</CardTitle><CardDescription>Export from Minda and upload here. Fields auto-map.</CardDescription></CardHeader>
          <CardContent>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer ${isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400'}`}>
              <input {...getInputProps()} /><Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">{isDragActive ? 'Drop here...' : 'Drag & drop CSV or click to browse'}</p>
            </div>
            <Button variant="outline" className="mt-4" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Download Template</Button>
          </CardContent>
        </Card>
      )}

      {step === 'map' && csv && (
        <Card>
          <CardHeader><CardTitle>Map Fields</CardTitle><CardDescription>Auto-detected {Object.keys(mappings).length}/{csv.headers.length} fields from {csv.rows.length} rows</CardDescription></CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] border rounded">
              <Table>
                <TableHeader><TableRow><TableHead>CSV Column</TableHead><TableHead>Sample</TableHead><TableHead>Pulse Field</TableHead></TableRow></TableHeader>
                <TableBody>
                  {csv.headers.map((h, i) => (
                    <TableRow key={h}>
                      <TableCell className="font-medium">{h}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{csv.rows[0]?.[i] || '—'}</TableCell>
                      <TableCell>
                        <Select value={mappings[h] || 'skip'} onValueChange={v => setMappings(p => ({ ...p, [h]: v === 'skip' ? '' : v }))}>
                          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">— Skip —</SelectItem>
                            {PULSE_FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.label} ({f.cat})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={reset}><X className="h-4 w-4 mr-2" />Start Over</Button>
              <Button onClick={processMap} className="bg-emerald-600 hover:bg-emerald-700">Continue<ArrowRight className="h-4 w-4 ml-2" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
            <div className="flex gap-4 mt-2">
              <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3 mr-1" />{parsed.filter(r => !r.errors.length).length} Ready</Badge>
              <Badge className="bg-amber-100 text-amber-800"><AlertTriangle className="h-3 w-3 mr-1" />{parsed.filter(r => r.warnings.length && !r.errors.length).length} Warnings</Badge>
              <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />{parsed.filter(r => r.errors.length).length} Errors</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] border rounded">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10"><Checkbox checked={selected.size === parsed.filter(r => !r.errors.length).length} onCheckedChange={c => setSelected(c ? new Set(parsed.filter(r => !r.errors.length).map(r => r.idx)) : new Set())} /></TableHead>
                  <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Sex</TableHead><TableHead>Breed</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {parsed.map(r => (
                    <TableRow key={r.idx} className={r.errors.length ? 'bg-red-50' : r.warnings.length ? 'bg-amber-50' : ''}>
                      <TableCell><Checkbox checked={selected.has(r.idx)} disabled={!!r.errors.length} onCheckedChange={c => { const s = new Set(selected); c ? s.add(r.idx) : s.delete(r.idx); setSelected(s); }} /></TableCell>
                      <TableCell className="font-mono text-sm">{r.mapped.cowId || r.mapped.visualId || r.mapped.naitTag || '—'}</TableCell>
                      <TableCell>{r.mapped.name || '—'}</TableCell>
                      <TableCell><Badge variant={r.mapped.sex === 'female' ? 'default' : 'secondary'}>{r.mapped.sex || '—'}</Badge></TableCell>
                      <TableCell>{r.mapped.breed || '—'}</TableCell>
                      <TableCell>{r.errors.length ? <Badge variant="destructive">{r.errors[0]}</Badge> : r.warnings.length ? <Badge className="bg-amber-100 text-amber-800">{r.warnings[0]}</Badge> : <Badge className="bg-emerald-100 text-emerald-800">Ready</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="mt-4 flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Button onClick={startImport} disabled={!selected.size} className="bg-emerald-600 hover:bg-emerald-700">Import {selected.size} Animals</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'importing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-emerald-600" />
            <h3 className="text-xl font-semibold mb-2">Importing...</h3>
            <Progress value={progress} className="w-64 mx-auto mb-2" />
            <p className="text-muted-foreground">{progress}% complete</p>
          </CardContent>
        </Card>
      )}

      {step === 'done' && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-600" />
            <h3 className="text-2xl font-bold text-emerald-800 mb-4">Import Complete!</h3>
            <div className="grid grid-cols-5 gap-4 max-w-xl mx-auto mb-6">
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.animals}</p><p className="text-sm text-emerald-600">Animals</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.health}</p><p className="text-sm text-emerald-600">Health</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.repro}</p><p className="text-sm text-emerald-600">Repro</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.weight}</p><p className="text-sm text-emerald-600">Weights</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{stats.prod}</p><p className="text-sm text-emerald-600">Production</p></div>
            </div>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={reset}>Import More</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.location.href = '/app/animals'}>View Animals</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
