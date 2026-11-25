import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnimalTreatmentSchema, type InsertAnimalTreatment, type User, type Product, type Condition, type AnimalTreatment, type ProductBatch, type Animal } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, Edit2, ArrowLeft, ArrowRight, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseDoseInterval } from "@shared/dose-schedule";
import { farmDate, farmDateTimeLocal } from "@shared/withholding";

// Now, in farm time, as the date-and-time box takes it (the server reads the box as New Zealand time)
const nowLocal = () => farmDateTimeLocal();

// A vet from the farm's list (Veterinary screen)
type Vet = { id: string; name: string; clinicName?: string | null; isActive?: boolean };

// Fields the form keeps for itself and turns into the treatment's own on save
type FormValues = InsertAnimalTreatment & {
  useBirthId?: boolean; id?: string; doseGivenNow?: boolean; meatWithholdingDays?: number | null;
  isGroup?: boolean; milkWithholdingUnit?: MilkUnit;
};

// Milk withholding as MINDA records it: in hours, days or milkings
type MilkUnit = "hours" | "days" | "milkings";
// How often the herd is milked, for withholding counted in milkings (the hours between milkings)
const MILKING_PATTERNS = [
  { hours: 12, label: "Twice a day" },
  { hours: 16, label: "3 in 2 days" },
  { hours: 24, label: "Once a day" },
];

// MINDA's dose units, and a few more
const DOSE_UNITS = ["mL", "mg", "g", "tube", "tablet", "capsule", "bolus", "oblet", "pessary", "sachet", "unit", "drops", "other"];

// The diagnosis list in its groups, in the list's own order
function groupConditions(conditions: Condition[]): [string, Condition[]][] {
  const groups = new Map<string, Condition[]>();
  for (const c of conditions) {
    if (c.isActive === false) continue;
    const key = c.category || "";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return Array.from(groups.entries());
}

const INTERVAL_PRESETS = [
  { hours: 12, label: "Twice daily (12 h)" },
  { hours: 24, label: "Daily (24 h)" },
  { hours: 48, label: "Every 48 h" },
  { hours: 72, label: "Every 72 h" },
];

type AnimalTreatmentFormProps = {
  users: User[];
  products: Product[];
  conditions: Condition[];
  // quiet: one of several animals in a group record (the form says how it went, once)
  onSubmit: (treatment: InsertAnimalTreatment & { id?: string }, opts?: { quiet?: boolean }) => void | boolean | Promise<void | boolean>;
  prefillTreatment?: AnimalTreatment | null;
  // Quick "Medical" record from an animal: the form opens filled in for it
  prefillAnimal?: { id: string; cowId: string } | null;
};

const createFormSchema = (conditions: Condition[], selectedCondition: string) => {
  return z.object({
    staffMember: z.string().min(1, "Staff member required"),
    dateTime: z.string(),
    cowId: z.string().optional(),
    birthId: z.object({
      participantCode: z.string(),
      year: z.string(),
      number: z.string(),
    }).optional(),
    condition: z.string().optional(),
    bodyPart: z.string().optional(),
    treatmentType: z.string().optional(),
    category: z.enum(['treatment', 'vaccination', 'drench']).default('treatment'),
    productId: z.string().optional(),
    treatmentPlan: z.string().optional(),
    clinicalNotes: z.string().optional(),
    status: z.enum(['active', 'completed']).default('active'),
    completedDate: z.string().optional(),
    dosesGiven: z.number().min(0).optional(),
    totalDoses: z.number().min(1).optional(),
    lastDoseDate: z.string().optional(),
    milkWithdrawalDays: z.number().min(0).optional(),
    milkWithdrawalEndDate: z.string().optional(),
    retreatmentOf: z.string().optional(),
    retreatmentReason: z.string().optional(),
    awaitingTreatment: z.boolean().optional(),
    monitoring: z.boolean().optional(),
    monitoringDays: z.number().min(1).optional(),
    monitoringStartDate: z.string().optional(),
    monitoringEndDate: z.string().optional(),
    useBirthId: z.boolean().default(false),
    // Kept through validation (unlisted fields are dropped), so the first dose is counted
    doseGivenNow: z.boolean().optional(),
    batchId: z.string().optional(),
    doseAmount: z.string().optional(),
    doseUnit: z.string().optional(),
    animalId: z.string().optional().nullable(),
    conditionId: z.string().optional().nullable(),
    doseIntervalHours: z.number().int().min(1, "At least 1 hour").max(8760).optional().nullable(),
    milkWithholdingHours: z.number().int().min(0).max(8760).optional().nullable(),
    meatWithholdingDays: z.number().min(0).max(365).optional().nullable(),
    separationDate: z.string().optional().nullable(),
    veterinarianId: z.string().optional().nullable(),
    vetName: z.string().max(255).optional().nullable(),
    isGroup: z.boolean().optional(),
    milkWithholdingUnit: z.enum(["hours", "days", "milkings"]).optional(),
    milkWithholdingMilkings: z.number().int().min(1, "At least 1 milking").max(100).optional().nullable(),
    milkingIntervalHours: z.number().int().min(1).max(48).optional().nullable(),
  }).superRefine((data: any, ctx: any) => {
    if (data.isGroup) {
      // A group record: the animals are picked from the herd list, not by cow number
    } else if (data.useBirthId) {
      if (!data.birthId?.participantCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Participant code is required",
          path: ["birthId", "participantCode"],
        });
      }
      if (!data.birthId?.year) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Year is required",
          path: ["birthId", "year"],
        });
      }
      if (!data.birthId?.number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Number is required",
          path: ["birthId", "number"],
        });
      }
    } else {
      if (!data.cowId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cow ID is required",
          path: ["cowId"],
        });
      }
    }

    // Condition is required unless in monitoring-only mode
    if (!data.monitoring && !data.condition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Condition is required",
        path: ["condition"],
      });
    }

    // Treatment type and plan are only required when NOT awaiting and NOT monitoring
    if (!data.awaitingTreatment && !data.monitoring) {
      if (!data.treatmentType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Treatment type is required for treatments",
          path: ["treatmentType"],
        });
      }
      if (!data.treatmentPlan) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Treatment plan is required for treatments",
          path: ["treatmentPlan"],
        });
      }
    }
    
    if (!data.awaitingTreatment && !data.monitoring && (data.totalDoses ?? 1) > 1 && !data.doseIntervalHours) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "How many hours between doses? It's needed to plan the next ones",
        path: ["doseIntervalHours"],
      });
    }

    if (data.milkWithholdingUnit === "milkings" && data.milkWithholdingMilkings && !data.milkingIntervalHours) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "How often is the herd milked?",
        path: ["milkingIntervalHours"],
      });
    }

    if (data.doseAmount && !data.batchId) {
      const doseNum = parseFloat(data.doseAmount);
      if (isNaN(doseNum) || doseNum <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dose amount must be greater than 0", path: ["doseAmount"] });
      }
    }

    if (data.monitoring && !data.monitoringDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Monitoring days required when monitoring is enabled",
        path: ["monitoringDays"],
      });
    }

    const condition = conditions.find(c => c.name === selectedCondition);
    if (condition?.requiresBodyPart && !data.bodyPart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${condition.bodyPartType === 'udder' ? 'Udder quarter' : 'Foot'} selection is required for ${condition.name}`,
        path: ["bodyPart"],
      });
    }

    // Batch traceability validation: if batch selected, dose fields are required
    if (data.batchId) {
      if (!data.doseAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dose amount is required when batch is selected",
          path: ["doseAmount"],
        });
      } else {
        const doseNum = parseFloat(data.doseAmount);
        if (isNaN(doseNum) || doseNum <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Dose amount must be greater than 0",
            path: ["doseAmount"],
          });
        }
      }
      if (!data.doseUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dose unit is required when batch is selected",
          path: ["doseUnit"],
        });
      }
    }
  });
};

export default function AnimalTreatmentForm({
  users,
  products,
  conditions,
  onSubmit,
  prefillTreatment,
  prefillAnimal,
}: AnimalTreatmentFormProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [useBirthId, setUseBirthId] = useState(prefillTreatment?.birthId ? true : false);
  const [selectedCondition, setSelectedCondition] = useState(prefillTreatment?.condition || "");
  const [selectedTreatment, setSelectedTreatment] = useState(prefillTreatment?.treatmentType || "");
  const [showBodyPartDialog, setShowBodyPartDialog] = useState(false);
  const [showEditPlanDialog, setShowEditPlanDialog] = useState(false);
  const [openStaffSelect, setOpenStaffSelect] = useState(false);
  const [openConditionSelect, setOpenConditionSelect] = useState(false);
  const [openTreatmentSelect, setOpenTreatmentSelect] = useState(false);
  const [openBatchSelect, setOpenBatchSelect] = useState(false);
  const [openDoseUnitSelect, setOpenDoseUnitSelect] = useState(false);
  const [openVetSelect, setOpenVetSelect] = useState(false);
  const [expandAwaitingHelp, setExpandAwaitingHelp] = useState(false);
  
  // Group treatment state
  const [isGroupTreatment, setIsGroupTreatment] = useState(false);
  const [selectedAnimals, setSelectedAnimals] = useState<string[]>([]);
  const [animalSearchQuery, setAnimalSearchQuery] = useState("");
  const [openAnimalSelect, setOpenAnimalSelect] = useState(false);

  // Fetch animals for group treatment
  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
    enabled: isGroupTreatment,
  });

  // Bulk entry: a whole Pulse group at once, or a batch of cow numbers typed in
  const { data: groups = [] } = useQuery<{ id: string; name: string; groupType?: string; isMob?: boolean }[]>({
    queryKey: ["/api/groups"],
    enabled: isGroupTreatment,
  });
  const { data: memberships = [] } = useQuery<{ groupId: string; animalId: string }[]>({
    queryKey: ["/api/groups/memberships"],
    enabled: isGroupTreatment,
  });
  const [cowNumbersText, setCowNumbersText] = useState("");
  const [notFound, setNotFound] = useState<string[]>([]);

  const addAnimals = (ids: string[]) => {
    const herd = new Set(animals.map(a => a.id));
    setSelectedAnimals(prev => Array.from(new Set([...prev, ...ids.filter(id => herd.has(id))])));
  };

  const addGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    let ids = memberships.filter(m => m.groupId === groupId).map(m => m.animalId);
    if (group?.groupType === "dynamic") {
      const res = await fetch(`/api/groups/${groupId}/dynamic-members`, { credentials: "include" });
      ids = res.ok ? ((await res.json()) as { id: string }[]).map(a => a.id) : [];
    }
    if (ids.length === 0) {
      toast.error(`${group?.name ?? "That group"} has no animals in it`);
      return;
    }
    addAnimals(ids);
  };

  // Cow numbers separated by spaces, commas or new lines, matched to the herd's cow numbers
  const addCowNumbers = () => {
    const numbers = cowNumbersText.split(/[\s,;]+/).map(n => n.trim()).filter(Boolean);
    const byNumber = new Map(animals.filter(a => a.visualId).map(a => [a.visualId!.toLowerCase(), a.id]));
    const found: string[] = [];
    const missing: string[] = [];
    for (const n of numbers) {
      const id = byNumber.get(n.toLowerCase());
      if (id) found.push(id); else missing.push(n);
    }
    addAnimals(found);
    setNotFound(missing);
    setCowNumbersText(missing.join(" "));
  };

  // The farm's vets, for who prescribed or authorised the treatment
  const { data: vets = [] } = useQuery<Vet[]>({ queryKey: ["/api/veterinary/vets"] });

  const formSchema = createFormSchema(conditions, selectedCondition);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: prefillTreatment ? {
      id: prefillTreatment.id,
      staffMember: prefillTreatment.staffMember || user?.name || "",
      dateTime: prefillTreatment.dateTime || nowLocal(),
      cowId: prefillTreatment.cowId || "",
      birthId: prefillTreatment.birthId || {
        participantCode: "",
        year: "",
        number: "",
      },
      condition: prefillTreatment.condition || "",
      bodyPart: prefillTreatment.bodyPart || "",
      treatmentType: "",
      category: prefillTreatment.category || "treatment" as const,
      treatmentPlan: "",
      totalDoses: 1,
      clinicalNotes: prefillTreatment.clinicalNotes || "",
      status: "active" as const,
      useBirthId: !!prefillTreatment.birthId,
      awaitingTreatment: false,
      batchId: prefillTreatment.batchId || "",
      doseAmount: prefillTreatment.doseAmount || "",
      doseUnit: prefillTreatment.doseUnit || "",
      doseGivenNow: false,
    } : {
      staffMember: user?.name || "",
      dateTime: nowLocal(),
      cowId: prefillAnimal?.cowId || "",
      animalId: prefillAnimal?.id || null,
      birthId: {
        participantCode: "",
        year: "",
        number: "",
      },
      condition: "",
      bodyPart: "",
      treatmentType: "",
      category: "treatment" as const,
      treatmentPlan: "",
      totalDoses: 1,
      clinicalNotes: "",
      status: "active" as const,
      useBirthId: false,
      awaitingTreatment: false,
      batchId: "",
      doseAmount: "",
      doseUnit: "",
      doseGivenNow: false,
    },
  });

  // Derive awaiting state from form - single source of truth
  const awaitingTreatment = useWatch({ control: form.control, name: "awaitingTreatment" }) ?? false;
  const selectedProductId = useWatch({ control: form.control, name: "productId" });
  const selectedTreatmentType = useWatch({ control: form.control, name: "treatmentType" });
  const selectedBatchId = useWatch({ control: form.control, name: "batchId" });
  const totalDosesWatch = useWatch({ control: form.control, name: "totalDoses" });
  const milkUnit: MilkUnit = useWatch({ control: form.control, name: "milkWithholdingUnit" }) ?? "hours";
  const milkingsWatch = useWatch({ control: form.control, name: "milkWithholdingMilkings" });

  // Fetch open batches for the selected product with custom queryFn
  const { data: batches = [], isLoading: batchesLoading } = useQuery<ProductBatch[]>({
    queryKey: ['product-batches', selectedProductId],
    queryFn: async () => {
      const res = await fetch('/api/product-batches?openOnly=true', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch batches');
      }
      const allBatches: ProductBatch[] = await res.json();
      // Filter to only show open batches for the selected product
      return allBatches.filter(
        batch => batch.status === 'open' && batch.productId === selectedProductId
      );
    },
    enabled: !!selectedProductId && !awaitingTreatment,
  });

  // Reset form when prefillTreatment changes
  useEffect(() => {
    if (prefillTreatment) {
      // Pre-fill form with existing treatment data
      form.reset({
        id: prefillTreatment.id,
        staffMember: prefillTreatment.staffMember || user?.name || "",
        dateTime: prefillTreatment.dateTime || nowLocal(),
        cowId: prefillTreatment.cowId || "",
        birthId: prefillTreatment.birthId || {
          participantCode: "",
          year: "",
          number: "",
        },
        condition: prefillTreatment.condition || "",
        bodyPart: prefillTreatment.bodyPart || "",
        treatmentType: "",
        treatmentPlan: "",
        totalDoses: 1,
        clinicalNotes: prefillTreatment.clinicalNotes || "",
        status: "active" as const,
        useBirthId: !!prefillTreatment.birthId,
        awaitingTreatment: false,
        batchId: prefillTreatment.batchId || "",
        doseAmount: prefillTreatment.doseAmount || "",
        doseUnit: prefillTreatment.doseUnit || "",
        animalId: prefillTreatment.animalId ?? null,
        conditionId: prefillTreatment.conditionId ?? null,
        separationDate: prefillTreatment.separationDate ?? "",
        veterinarianId: prefillTreatment.veterinarianId ?? "",
        vetName: prefillTreatment.vetName ?? "",
      });
      
      // Update local state
      setUseBirthId(!!prefillTreatment.birthId);
      setSelectedCondition(prefillTreatment.condition || "");
      setSelectedTreatment(""); // Treatment type is empty for awaiting treatments
      setStep(1); // Start at step 1 to allow user to review/confirm data
    } else {
      // Reset to empty form when prefillTreatment is cleared; filled in for an animal for a quick record
      form.reset({
        staffMember: user?.name || "",
        dateTime: nowLocal(),
        cowId: prefillAnimal?.cowId || "",
        animalId: prefillAnimal?.id || null,
        birthId: { participantCode: "", year: "", number: "" },
        condition: "",
        bodyPart: "",
        treatmentType: "",
        treatmentPlan: "",
        totalDoses: 1,
        clinicalNotes: "",
        status: "active",
        useBirthId: false,
        awaitingTreatment: false,
        batchId: "",
        doseAmount: "",
        doseUnit: "",
      });
      // Who, when and which animal are filled in already: start at the diagnosis
      setStep(prefillAnimal ? 2 : 1);
      setSelectedCondition("");
      setSelectedTreatment("");
      setUseBirthId(false);
    }
  }, [prefillTreatment, prefillAnimal?.id]);

  const parseTotalDoses = (treatmentPlan: string): number => {
    const lowerPlan = treatmentPlan.toLowerCase();
    
    const dailyWithQualifierPattern = /(?:once|twice)\s+(?:a\s+)?daily\s+for\s+(?:up\s+to\s+)?(\d+)(?:-(\d+))?\s+days?(?:\s+total)?/i;
    const dailyMatch = lowerPlan.match(dailyWithQualifierPattern);
    if (dailyMatch && dailyMatch[1]) {
      const minDays = parseInt(dailyMatch[1], 10);
      const maxDays = dailyMatch[2] ? parseInt(dailyMatch[2], 10) : minDays;
      const days = Math.max(minDays, maxDays);
      
      const isTwiceDaily = /twice\s+(?:a\s+)?daily/i.test(lowerPlan);
      return isTwiceDaily ? days * 2 : days;
    }
    
    const forDaysPattern = /for\s+(\d+)\s+days?/i;
    const forDaysMatch = lowerPlan.match(forDaysPattern);
    if (forDaysMatch && forDaysMatch[1]) {
      return parseInt(forDaysMatch[1], 10);
    }
    
    const dosePattern = /(\d+)\s+(?:tubes?|doses?|injections?)/i;
    const doseMatch = lowerPlan.match(dosePattern);
    if (doseMatch && doseMatch[1]) {
      const doses = parseInt(doseMatch[1], 10);
      if (doses > 0 && doses <= 20) return doses;
    }
    
    const repeatPattern = /repeat\s+(?:after|in)\s+\d+\s+hours?/i;
    if (repeatPattern.test(lowerPlan)) {
      return 2;
    }
    
    return 1;
  };

  const currentTreatmentPlan = useWatch({ control: form.control, name: "treatmentPlan" });
  useEffect(() => {
    if (currentTreatmentPlan) {
      const suggestedDoses = parseTotalDoses(currentTreatmentPlan);
      form.setValue("totalDoses", suggestedDoses);
      // The hours between doses, when the plan says (e.g. "once daily", "repeat after 48 hours")
      const interval = parseDoseInterval(currentTreatmentPlan);
      if (interval) form.setValue("doseIntervalHours", interval);
    }
  }, [currentTreatmentPlan]);

  // Clear batch fields when awaiting treatment is toggled
  useEffect(() => {
    if (awaitingTreatment) {
      form.setValue("batchId", "");
      form.setValue("doseAmount", "");
      form.setValue("doseUnit", "");
    }
  }, [awaitingTreatment]);

  const currentCondition = useWatch({ control: form.control, name: "condition" });
  const selectedConditionObj = conditions.find(c => c.name === currentCondition);
  const currentBodyPart = useWatch({ control: form.control, name: "bodyPart" });

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];
    
    if (step === 1) {
      fieldsToValidate = ["staffMember", "dateTime"];
      if (isGroupTreatment && !prefillTreatment) {
        if (selectedAnimals.length === 0) {
          toast.error("Pick the animals for the group record");
          return;
        }
      } else if (useBirthId) {
        fieldsToValidate.push("birthId.participantCode", "birthId.year", "birthId.number");
      } else {
        fieldsToValidate.push("cowId");
      }
    } else if (step === 2) {
      // When awaiting treatment, only validate condition and body part
      if (awaitingTreatment) {
        fieldsToValidate = ["condition"];
        if (selectedConditionObj?.requiresBodyPart) {
          fieldsToValidate.push("bodyPart");
        }
      } else {
        // Standard workflow: validate all treatment fields
        fieldsToValidate = ["condition", "treatmentType", "treatmentPlan", "totalDoses", "doseIntervalHours", "milkWithholdingHours", "meatWithholdingDays"];
        if (selectedConditionObj?.requiresBodyPart) {
          fieldsToValidate.push("bodyPart");
        }
      }
    }

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleFormSubmit = async (data: FormValues) => {
    const { useBirthId: _, doseGivenNow, meatWithholdingDays, isGroup: _g, milkWithholdingUnit, ...treatmentData } = data;
    const inMilkings = milkWithholdingUnit === "milkings" && !!treatmentData.milkWithholdingMilkings;
    const treatment: InsertAnimalTreatment & { id?: string } = {
      ...treatmentData,
      id: prefillTreatment?.id, // Include ID if editing existing treatment
      cowId: useBirthId ? undefined : data.cowId,
      birthId: useBirthId ? data.birthId : undefined,
      bodyPart: treatmentData.bodyPart || undefined,
      clinicalNotes: treatmentData.clinicalNotes || undefined,
      animalId: treatmentData.animalId || undefined,
      conditionId: treatmentData.conditionId || undefined,
      // The staff member picked, by id as well as name
      staffMemberId: users.find(u => u.name === treatmentData.staffMember)?.id ?? treatmentData.staffMemberId,
      // An empty box isn't a batch; the amount per dose is kept with or without one
      batchId: treatmentData.batchId || undefined,
      doseAmount: treatmentData.doseAmount || undefined,
      doseUnit: treatmentData.doseAmount ? treatmentData.doseUnit || undefined : undefined,
      separationDate: treatmentData.separationDate || undefined,
      veterinarianId: treatmentData.veterinarianId || undefined,
      vetName: treatmentData.vetName?.trim() || undefined,
      // Left out when not entered, so the server takes the product's
      // In milkings, the server works out the hours from the milkings and how often the herd is milked
      milkWithholdingHours: inMilkings ? undefined : treatmentData.milkWithholdingHours ?? undefined,
      milkWithholdingMilkings: inMilkings ? treatmentData.milkWithholdingMilkings : null,
      milkingIntervalHours: inMilkings ? treatmentData.milkingIntervalHours : null,
      meatWithholdingHours: meatWithholdingDays != null ? Math.round(meatWithholdingDays * 24) : undefined,
      doseIntervalHours: (treatmentData.totalDoses ?? 1) > 1 ? treatmentData.doseIntervalHours ?? undefined : undefined,
    };

    // If creating new treatment and dose given now, set first dose
    if (!prefillTreatment && doseGivenNow) {
      const dt = form.getValues("dateTime") || nowLocal();
      treatment.dosesGiven = Math.max(1, treatment.dosesGiven || 0);
      treatment.lastDoseDate = dt;
    }
    if (isGroupTreatment && !prefillTreatment) {
      // A group record: the same health event for each animal picked, as in MINDA
      const picked = animals.filter(a => selectedAnimals.includes(a.id));
      let saved = 0;
      for (const a of picked) {
        const one = { ...treatment, animalId: a.id, cowId: a.visualId || undefined, birthId: undefined };
        if ((await onSubmit(one, { quiet: true })) !== false) saved++;
      }
      if (saved === 0) return;
      if (saved < picked.length) toast.error(`Recorded for ${saved} of ${picked.length} animals`);
      else toast.success(`Recorded for ${saved} animals`);
      setSelectedAnimals([]);
    } else if ((await onSubmit(treatment)) === false) {
      // Kept as entered if it wasn't saved, so nothing has to be typed again
      return;
    }

    // Only reset form if NOT editing (editing will be handled by parent clearing prefillTreatment)
    if (!prefillTreatment) {
      form.reset({
        staffMember: user?.name || "",
        dateTime: nowLocal(),
        cowId: "",
        animalId: null,
        birthId: { participantCode: "", year: "", number: "" },
        condition: "",
        conditionId: null,
        bodyPart: "",
        treatmentType: "",
        treatmentPlan: "",
        clinicalNotes: "",
        status: "active",
        useBirthId: false,
        batchId: "",
        doseAmount: "",
        doseUnit: "",
        doseIntervalHours: null,
        milkWithholdingHours: null,
        meatWithholdingDays: null,
        separationDate: "",
        veterinarianId: "",
        vetName: "",
        milkWithholdingUnit: "hours",
        milkWithholdingMilkings: null,
        milkingIntervalHours: null,
        isGroup: isGroupTreatment,
      });
      setStep(1);
      setSelectedCondition("");
      setSelectedTreatment("");
      setUseBirthId(false);
    }
  };

  const renderUdderQuarterSelector = () => {
    const selectedParts = currentBodyPart ? currentBodyPart.split(',').filter(p => p) : [];
    
    const toggleBodyPart = (value: string) => {
      const current = form.getValues("bodyPart") || "";
      const parts = current ? current.split(',').filter(p => p) : [];
      const index = parts.indexOf(value);
      if (index > -1) {
        parts.splice(index, 1);
      } else {
        parts.push(value);
      }
      form.setValue("bodyPart", parts.join(','), { shouldValidate: true });
    };

    return (
      <Dialog open={showBodyPartDialog} onOpenChange={setShowBodyPartDialog}>
        <DialogContent data-testid="dialog-udder-selector">
          <DialogHeader>
            <DialogTitle>Select Udder Quarters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "LF", label: "Left Front" },
                { value: "RF", label: "Right Front" },
                { value: "LR", label: "Left Rear" },
                { value: "RR", label: "Right Rear" },
              ].map((quarter) => (
                <Button
                  key={quarter.value}
                  size="lg"
                  variant={selectedParts.includes(quarter.value) ? "default" : "outline"}
                  onClick={() => toggleBodyPart(quarter.value)}
                  data-testid={`button-udder-${quarter.value.toLowerCase()}`}
                >
                  {quarter.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              onClick={() => setShowBodyPartDialog(false)}
              className="w-full"
              data-testid="button-done-udder"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderFootSelector = () => {
    const selectedParts = currentBodyPart ? currentBodyPart.split(',').filter(p => p) : [];
    
    const toggleBodyPart = (value: string) => {
      const current = form.getValues("bodyPart") || "";
      const parts = current ? current.split(',').filter(p => p) : [];
      const index = parts.indexOf(value);
      if (index > -1) {
        parts.splice(index, 1);
      } else {
        parts.push(value);
      }
      form.setValue("bodyPart", parts.join(','), { shouldValidate: true });
    };

    return (
      <Dialog open={showBodyPartDialog} onOpenChange={setShowBodyPartDialog}>
        <DialogContent data-testid="dialog-foot-selector">
          <DialogHeader>
            <DialogTitle>Select Feet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "LF", label: "Left Front" },
                { value: "RF", label: "Right Front" },
                { value: "LH", label: "Left Hind" },
                { value: "RH", label: "Right Hind" },
              ].map((foot) => (
                <Button
                  key={foot.value}
                  size="lg"
                  variant={selectedParts.includes(foot.value) ? "default" : "outline"}
                  onClick={() => toggleBodyPart(foot.value)}
                  data-testid={`button-foot-${foot.value.toLowerCase()}`}
                >
                  {foot.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              onClick={() => setShowBodyPartDialog(false)}
              className="w-full"
              data-testid="button-done-foot"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Card data-testid="card-animal-treatment-form">
      <CardHeader>
        <CardTitle>Treatment Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="staffMember"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Member *</FormLabel>
                      <Popover open={openStaffSelect} onOpenChange={setOpenStaffSelect}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-select-staff"
                            >
                              {field.value || "Select staff member..."}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Search staff..." data-testid="input-search-staff" />
                            <CommandList>
                              <CommandEmpty>No staff found.</CommandEmpty>
                              <CommandGroup>
                                {users.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={user.name}
                                    onSelect={() => {
                                      field.onChange(user.name);
                                      setOpenStaffSelect(false);
                                    }}
                                    data-testid={`option-staff-${user.id}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === user.name ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {user.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date and Time *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-datetime" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Group Treatment Toggle */}
                {!prefillTreatment && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ backgroundColor: isGroupTreatment ? '#f0ebe4' : 'transparent', borderColor: '#e8e4de' }}>
                    <Checkbox
                      id="group-treatment"
                      checked={isGroupTreatment}
                      onCheckedChange={(checked) => {
                        setIsGroupTreatment(checked === true);
                        form.setValue("isGroup", checked === true);
                        if (!checked) {
                          setSelectedAnimals([]);
                        }
                      }}
                    />
                    <label htmlFor="group-treatment" className="text-sm font-medium cursor-pointer flex items-center gap-2" style={{ color: '#1a3a2f' }}>
                      <Users className="h-4 w-4" />
                      Group Treatment
                      <span className="text-xs font-normal" style={{ color: '#636e72' }}>
                        (treat multiple animals at once)
                      </span>
                    </label>
                  </div>
                )}

                <div className="space-y-2">
                  {/* Group Treatment - Multi-animal selector */}
                  {isGroupTreatment && !prefillTreatment ? (
                    <div className="space-y-3">
                      <FormLabel>Select Animals *</FormLabel>

                      {/* Bulk entry: a whole group, or a batch of cow numbers */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Add a group</p>
                          <Select value="" onValueChange={addGroup}>
                            <SelectTrigger data-testid="select-bulk-group">
                              <SelectValue placeholder={groups.length ? "Choose a group or mob..." : "No groups yet"} />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map(g => {
                                const n = memberships.filter(m => m.groupId === g.id).length;
                                return (
                                  <SelectItem key={g.id} value={g.id} data-testid={`option-bulk-group-${g.id}`}>
                                    {g.name}{g.groupType === "dynamic" ? "" : ` (${n})`}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Or type cow numbers</p>
                          <div className="flex gap-2">
                            <Textarea
                              rows={2}
                              placeholder="e.g. 254 367 480"
                              value={cowNumbersText}
                              onChange={(e) => setCowNumbersText(e.target.value)}
                              data-testid="input-bulk-cow-numbers"
                            />
                            <Button type="button" variant="outline" onClick={addCowNumbers} disabled={!cowNumbersText.trim()} data-testid="button-add-cow-numbers">
                              Add
                            </Button>
                          </div>
                          {notFound.length > 0 && (
                            <p className="text-xs text-red-700" data-testid="text-cows-not-found">
                              Not in the herd: {notFound.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Selected animals badges */}
                      {selectedAnimals.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 rounded border" style={{ borderColor: '#e8e4de' }}>
                          {selectedAnimals.map(animalId => {
                            const animal = animals.find(a => a.id === animalId);
                            return (
                              <Badge 
                                key={animalId} 
                                variant="secondary"
                                className="flex items-center gap-1 cursor-pointer hover:bg-red-100"
                                onClick={() => setSelectedAnimals(prev => prev.filter(id => id !== animalId))}
                              >
                                {animal?.visualId || animal?.name || animalId}
                                <X className="h-3 w-3" />
                              </Badge>
                            );
                          })}
                          <span className="text-xs self-center" style={{ color: '#636e72' }}>
                            {selectedAnimals.length} selected
                          </span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedAnimals([])} data-testid="button-clear-animals">
                            Clear all
                          </Button>
                        </div>
                      )}
                      
                      {/* Animal search and select */}
                      <Popover open={openAnimalSelect} onOpenChange={setOpenAnimalSelect}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {selectedAnimals.length > 0 
                              ? `${selectedAnimals.length} animals selected` 
                              : "Search and select animals..."}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search by tag, name, or ID..." 
                              value={animalSearchQuery}
                              onValueChange={setAnimalSearchQuery}
                            />
                            <CommandList>
                              <CommandEmpty>No animals found.</CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-[200px]">
                                  {animals
                                    .filter(animal => {
                                      const query = animalSearchQuery.toLowerCase();
                                      return (
                                        animal.visualId?.toLowerCase().includes(query) ||
                                        animal.name?.toLowerCase().includes(query) ||
                                        animal.naitTag?.toLowerCase().includes(query)
                                      );
                                    })
                                    .slice(0, 50)
                                    .map((animal) => (
                                      <CommandItem
                                        key={animal.id}
                                        value={animal.visualId || animal.name || animal.id}
                                        onSelect={() => {
                                          setSelectedAnimals(prev => 
                                            prev.includes(animal.id)
                                              ? prev.filter(id => id !== animal.id)
                                              : [...prev, animal.id]
                                          );
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedAnimals.includes(animal.id) ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span className="font-medium">{animal.visualId || animal.name}</span>
                                        {animal.breed && (
                                          <span className="ml-2 text-xs text-muted-foreground">{animal.breed}</span>
                                        )}
                                      </CommandItem>
                                    ))}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <>
                      {/* Single Animal - Original UI */}
                      {!prefillTreatment && (
                        <div className="flex items-center gap-4">
                          <Button
                            type="button"
                            variant={!useBirthId ? "default" : "outline"}
                            onClick={() => {
                              setUseBirthId(false);
                              form.setValue("useBirthId", false);
                            }}
                            data-testid="button-use-cow-id"
                          >
                            Cow ID
                          </Button>
                          <Button
                            type="button"
                            variant={useBirthId ? "default" : "outline"}
                            onClick={() => {
                              setUseBirthId(true);
                              form.setValue("useBirthId", true);
                            }}
                            data-testid="button-use-birth-id"
                          >
                            Birth ID
                          </Button>
                        </div>
                      )}

                      {!useBirthId ? (
                        <FormField
                          control={form.control}
                          name="cowId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cow ID *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter cow ID" 
                                  {...field} 
                                  disabled={!!prefillTreatment}
                                  data-testid="input-cow-id" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <div className="space-y-2">
                          <FormLabel>Birth ID *</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                            <FormField
                              control={form.control}
                              name="birthId.participantCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      placeholder="Ptpt" 
                                      {...field} 
                                      disabled={!!prefillTreatment}
                                      data-testid="input-birth-participant" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="birthId.year"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      placeholder="Year" 
                                      {...field} 
                                      disabled={!!prefillTreatment}
                                      data-testid="input-birth-year" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="birthId.number"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      placeholder="Number" 
                                      {...field} 
                                      disabled={!!prefillTreatment}
                                      data-testid="input-birth-number" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    onClick={handleNext}
                    size="default"
                    className="flex-1"
                    data-testid="button-next-step-1"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition / Diagnosis *</FormLabel>
                      <Popover open={openConditionSelect} onOpenChange={setOpenConditionSelect}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-select-condition"
                            >
                              {field.value || "Select condition..."}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Search conditions..." data-testid="input-search-condition" />
                            <CommandList>
                              <CommandEmpty>No diagnosis found. Add it under Manage.</CommandEmpty>
                              {groupConditions(conditions).map(([group, items]) => (
                              <CommandGroup key={group || "-"} heading={group || undefined}>
                                {items.map((condition) => (
                                  <CommandItem
                                    key={condition.id}
                                    value={`${condition.code ?? ""} ${condition.name} ${condition.category ?? ""}`}
                                    onSelect={() => {
                                      field.onChange(condition.name);
                                      form.setValue("conditionId", condition.id.length === 36 ? condition.id : null);
                                      setSelectedCondition(condition.name);
                                      setOpenConditionSelect(false);
                                      if (condition.requiresBodyPart) {
                                        setShowBodyPartDialog(true);
                                      }
                                    }}
                                    data-testid={`option-condition-${condition.id}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === condition.name ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {condition.code && <span className="mr-2 font-mono text-xs text-muted-foreground">{condition.code}</span>}
                                    {condition.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedConditionObj?.requiresBodyPart && (
                  <FormField
                    control={form.control}
                    name="bodyPart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Affected {selectedConditionObj.bodyPartType === 'udder' ? 'Udder Quarter' : 'Foot'} *
                        </FormLabel>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowBodyPartDialog(true)}
                            className="w-full justify-start"
                            data-testid="button-select-body-part"
                          >
                            {field.value || `Select ${selectedConditionObj.bodyPartType === 'udder' ? 'quarter' : 'foot'}...`}
                          </Button>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="awaitingTreatment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-4 bg-muted/30">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-awaiting-treatment"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none flex-1">
                        <FormLabel className="cursor-pointer flex items-center gap-1">
                          <span>Save to awaiting - will be looked at later</span>
                          <button
                            type="button"
                            onClick={() => setExpandAwaitingHelp(!expandAwaitingHelp)}
                            className="text-blue-600 hover:text-blue-700 font-bold text-sm"
                            data-testid="button-expand-awaiting-help"
                          >
                            .....
                          </button>
                        </FormLabel>
                        {expandAwaitingHelp && (
                          <p className="text-sm text-muted-foreground">
                            Check this box to save the cow's condition without entering a treatment plan yet. You can add the treatment plan later from the Awaiting tab.
                          </p>
                        )}
                      </div>
                    </FormItem>
                  )}
                />

                {!awaitingTreatment && (
                  <>
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Treatment Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || "treatment"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="treatment">Medical Treatment</SelectItem>
                              <SelectItem value="vaccination">Vaccination</SelectItem>
                              <SelectItem value="drench">Drench/Parasite Control</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="treatmentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Treatment Type *</FormLabel>
                          <Popover open={openTreatmentSelect} onOpenChange={setOpenTreatmentSelect}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="button-select-treatment"
                                >
                                  {field.value || "Select treatment..."}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search treatments..." data-testid="input-search-treatment" />
                                <CommandList>
                                  <CommandEmpty>No treatment found.</CommandEmpty>
                                  <CommandGroup>
                                    {products.map((product) => (
                                      <CommandItem
                                        key={product.id}
                                        value={product.name}
                                        onSelect={() => {
                                          field.onChange(product.name);
                                          setSelectedTreatment(product.name);
                                          form.setValue("productId", product.id);
                                          form.setValue("treatmentPlan", product.treatmentPlan || "");
                                          // The product's withholding, which can be changed for this treatment
                                          const milkDays = product.milkWithdrawalDays ?? product.withdrawalDays;
                                          form.setValue("milkWithholdingHours", milkDays != null ? milkDays * 24 : null);
                                          form.setValue("milkWithholdingUnit", "days");
                                          form.setValue("milkWithholdingMilkings", null);
                                          form.setValue("meatWithholdingDays", product.meatWithdrawalDays ?? null);
                                          // Clear batch fields when product changes
                                          form.setValue("batchId", "");
                                          form.setValue("doseAmount", "");
                                          form.setValue("doseUnit", "");
                                          setOpenTreatmentSelect(false);
                                        }}
                                        data-testid={`option-treatment-${product.id}`}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === product.name ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {product.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedTreatmentType && (
                      <>
                        {/* Batch Selection */}
                        <FormField
                          control={form.control}
                          name="batchId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Batch (Optional)</FormLabel>
                              <Popover open={openBatchSelect} onOpenChange={setOpenBatchSelect}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn(
                                        "w-full justify-between",
                                        !field.value && "text-muted-foreground"
                                      )}
                                      data-testid="button-select-batch"
                                    >
                                      {field.value 
                                        ? batches.find(b => b.id === field.value)?.batchNo || "Batch not found"
                                        : "Select batch to track usage..."}
                                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                  <Command>
                                    <CommandInput placeholder="Search batches..." data-testid="input-search-batch" />
                                    <CommandList>
                                      {batchesLoading ? (
                                        <CommandEmpty>Loading batches...</CommandEmpty>
                                      ) : batches.length === 0 ? (
                                        <CommandEmpty>No open batches for this product</CommandEmpty>
                                      ) : (
                                        <CommandGroup>
                                          {batches.map((batch) => (
                                            <CommandItem
                                              key={batch.id}
                                              value={`${batch.batchNo} ${batch.expiryDate || ''}`}
                                              onSelect={() => {
                                                field.onChange(batch.id);
                                                setOpenBatchSelect(false);
                                              }}
                                              data-testid={`option-batch-${batch.id}`}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  field.value === batch.id ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              <div className="flex flex-col">
                                                <span className="font-medium">Batch {batch.batchNo}</span>
                                                {batch.expiryDate && (
                                                  <span className="text-xs text-muted-foreground">
                                                    Expires {format(new Date(batch.expiryDate), 'dd MMM yyyy')}
                                                  </span>
                                                )}
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      )}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <p className="text-xs text-muted-foreground">
                                Select batch to track stock usage and enable full traceability
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Amount per dose and unit (MINDA's dosage); needed when a batch is picked, for the stock */}
                        {(
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="doseAmount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Amount per dose{selectedBatchId ? " *" : ""}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="0.0"
                                      {...field}
                                      onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        field.onChange(!isNaN(val) ? val.toString() : "");
                                      }}
                                      data-testid="input-dose-amount"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="doseUnit"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Unit{selectedBatchId ? " *" : ""}</FormLabel>
                                  <Popover open={openDoseUnitSelect} onOpenChange={setOpenDoseUnitSelect}>
                                    <PopoverTrigger asChild>
                                      <FormControl>
                                        <Button
                                          variant="outline"
                                          role="combobox"
                                          className={cn(
                                            "w-full justify-between",
                                            !field.value && "text-muted-foreground"
                                          )}
                                          data-testid="button-select-dose-unit"
                                        >
                                          {field.value || "Unit..."}
                                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                      </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                      <Command>
                                        <CommandList>
                                          <CommandGroup>
                                            {DOSE_UNITS.map((unit) => (
                                              <CommandItem
                                                key={unit}
                                                value={unit}
                                                onSelect={() => {
                                                  field.onChange(unit);
                                                  setOpenDoseUnitSelect(false);
                                                }}
                                                data-testid={`option-dose-unit-${unit}`}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    field.value === unit ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                {unit}
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        <FormField
                          control={form.control}
                          name="treatmentPlan"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Treatment Plan</FormLabel>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowEditPlanDialog(true)}
                                  data-testid="button-edit-plan"
                                >
                                  <Edit2 className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                              </div>
                              <div className="p-3 bg-muted rounded-md">
                                <p className="text-sm" data-testid="text-treatment-plan">
                                  {field.value || "No treatment plan specified"}
                                </p>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="totalDoses"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Doses *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                                  data-testid="input-total-doses"
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">
                                Auto-detected from treatment plan. Adjust if needed.
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Hours between doses: plans the follow-up doses and shows when each is due */}
                        {(totalDosesWatch ?? 1) > 1 && (
                          <FormField
                            control={form.control}
                            name="doseIntervalHours"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Hours between doses *</FormLabel>
                                <div className="flex flex-wrap gap-2">
                                  {INTERVAL_PRESETS.map((p) => (
                                    <Button
                                      key={p.hours}
                                      type="button"
                                      size="sm"
                                      variant={field.value === p.hours ? "default" : "outline"}
                                      onClick={() => field.onChange(p.hours)}
                                      data-testid={`button-interval-${p.hours}`}
                                    >
                                      {p.label}
                                    </Button>
                                  ))}
                                </div>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    placeholder="Hours"
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                                    data-testid="input-dose-interval"
                                  />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">
                                  Each dose is due this long after the one before. Taken from the treatment plan where it says.
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Withholding: from the product, can be changed for this treatment. Counted from the last dose. */}
                        <div className="grid grid-cols-2 gap-3">
                          {milkUnit === "milkings" ? (
                            <FormField
                              key="milk-milkings"
                              control={form.control}
                              name="milkWithholdingMilkings"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Milk withholding (milkings)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="Milkings"
                                      value={field.value ?? ""}
                                      onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                                      data-testid="input-milk-withholding-milkings"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ) : (
                            <FormField
                              key="milk-hours"
                              control={form.control}
                              name="milkWithholdingHours"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Milk withholding ({milkUnit})</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0"
                                      step={milkUnit === "days" ? "0.5" : "1"}
                                      placeholder="From the product"
                                      value={field.value == null ? "" : milkUnit === "days" ? field.value / 24 : field.value}
                                      onChange={(e) => {
                                        if (e.target.value === "") return field.onChange(null);
                                        const v = Number(e.target.value);
                                        field.onChange(Math.round(milkUnit === "days" ? v * 24 : v));
                                      }}
                                      data-testid="input-milk-withholding"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={form.control}
                            name="meatWithholdingDays"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Meat withholding (days)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="From the product"
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                                    data-testid="input-meat-withholding"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 -mt-1">
                          <span className="text-xs text-muted-foreground">Milk withholding in</span>
                          {(["hours", "days", "milkings"] as MilkUnit[]).map((u) => (
                            <Button
                              key={u}
                              type="button"
                              size="sm"
                              variant={milkUnit === u ? "default" : "outline"}
                              onClick={() => form.setValue("milkWithholdingUnit", u)}
                              data-testid={`button-milk-unit-${u}`}
                            >
                              {u}
                            </Button>
                          ))}
                        </div>
                        {milkUnit === "milkings" && (
                          <FormField
                            control={form.control}
                            name="milkingIntervalHours"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>The herd is milked</FormLabel>
                                <div className="flex flex-wrap gap-2">
                                  {MILKING_PATTERNS.map((p) => (
                                    <Button
                                      key={p.hours}
                                      type="button"
                                      size="sm"
                                      variant={field.value === p.hours ? "default" : "outline"}
                                      onClick={() => field.onChange(p.hours)}
                                      data-testid={`button-milking-pattern-${p.hours}`}
                                    >
                                      {p.label}
                                    </Button>
                                  ))}
                                </div>
                                {milkingsWatch && field.value ? (
                                  <p className="text-xs text-muted-foreground">
                                    {milkingsWatch} milkings: back in the vat {milkingsWatch * field.value} hours after the last dose.
                                  </p>
                                ) : null}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <p className="text-xs text-muted-foreground -mt-2">
                          Both run from the last dose. Check the product label.
                        </p>

                        {/* Dose given now - counts as first dose on create */}
                        {!prefillTreatment && (
                          <FormField
                            control={form.control}
                            name="doseGivenNow"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-4 bg-muted/30">
                                <FormControl>
                                  <Checkbox
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-dose-given-now"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none flex-1">
                                  <FormLabel className="cursor-pointer">Dose given now (count this as first dose)</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        )}

                      </>
                    )}

                  </>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    size="default"
                    className="flex-1"
                    data-testid="button-back-step-2"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNext}
                    size="default"
                    className="flex-1"
                    data-testid="button-next-step-2"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {!awaitingTreatment && (
                  <FormField
                    control={form.control}
                    name="separationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Separated from the milking herd</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="flex-1"
                              data-testid="input-separation-date"
                            />
                          </FormControl>
                          <Button type="button" variant="outline" onClick={() => field.onChange(farmDate(new Date()))} data-testid="button-separation-today">
                            Today
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          The day she was, or must be, drafted out of the milking herd.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="veterinarianId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vet (prescribed or authorised)</FormLabel>
                      <Popover open={openVetSelect} onOpenChange={setOpenVetSelect}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn("w-full justify-between", !field.value && !form.getValues("vetName") && "text-muted-foreground")}
                              data-testid="button-select-vet"
                            >
                              {vets.find(v => v.id === field.value)?.name || form.getValues("vetName") || "Select vet..."}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Search vets..." data-testid="input-search-vet" />
                            <CommandList>
                              <CommandEmpty>Not on the farm's list. Type the name below, or add the vet on the Veterinary screen.</CommandEmpty>
                              <CommandGroup>
                                {vets.filter(v => v.isActive !== false).map((vet) => (
                                  <CommandItem
                                    key={vet.id}
                                    value={`${vet.name} ${vet.clinicName ?? ""}`}
                                    onSelect={() => {
                                      field.onChange(vet.id);
                                      form.setValue("vetName", vet.name);
                                      setOpenVetSelect(false);
                                    }}
                                    data-testid={`option-vet-${vet.id}`}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", field.value === vet.id ? "opacity-100" : "opacity-0")} />
                                    {vet.name}
                                    {vet.clinicName && <span className="ml-2 text-xs text-muted-foreground">{vet.clinicName}</span>}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Input
                        placeholder="Or type the vet's name"
                        value={field.value ? "" : form.watch("vetName") ?? ""}
                        onChange={(e) => {
                          field.onChange("");
                          form.setValue("vetName", e.target.value);
                        }}
                        data-testid="input-vet-name"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clinicalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clinical Notes / Symptoms</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Swollen quarter, limping left hind, off feed, etc."
                          rows={6}
                          {...field}
                          data-testid="input-clinical-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    size="default"
                    className="flex-1"
                    data-testid="button-back-step-3"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="default"
                    className="flex-1"
                    data-testid="button-save-treatment"
                  >
                    Save Treatment
                  </Button>
                </div>
              </div>
            )}

            {selectedConditionObj?.bodyPartType === 'udder' && renderUdderQuarterSelector()}
            {selectedConditionObj?.bodyPartType === 'foot' && renderFootSelector()}

            <Dialog open={showEditPlanDialog} onOpenChange={setShowEditPlanDialog}>
              <DialogContent data-testid="dialog-edit-plan">
                <DialogHeader>
                  <DialogTitle>Edit Treatment Plan</DialogTitle>
                </DialogHeader>
                <FormField
                  control={form.control}
                  name="treatmentPlan"
                  render={({ field }) => (
                    <div className="space-y-4 pt-4">
                      <Textarea
                        placeholder="Enter treatment plan..."
                        rows={4}
                        {...field}
                        data-testid="input-edit-plan"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowEditPlanDialog(false)}
                          data-testid="button-cancel-edit-plan"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setShowEditPlanDialog(false)}
                          className="flex-1"
                          data-testid="button-save-edit-plan"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}
                />
              </DialogContent>
            </Dialog>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
