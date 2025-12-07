import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, AlertTriangle, TrendingUp, TrendingDown, Activity,
  Heart, Thermometer, Scale, Droplets, Bug, Bone, Baby,
  Shield, Clock, ChevronRight, Info, Sparkles, Target,
  CheckCircle2, XCircle, AlertCircle, Loader2
} from "lucide-react";
import { format, differenceInDays, subDays } from "date-fns";
import type { Animal, AnimalTreatment, WeightRecord, HealthScore } from "@shared/schema";

// Risk level definitions
const RISK_LEVELS = {
  low: { label: "Low Risk", color: "text-green-600", bg: "bg-green-100", border: "border-green-500" },
  moderate: { label: "Moderate Risk", color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-500" },
  high: { label: "High Risk", color: "text-orange-600", bg: "bg-orange-100", border: "border-orange-500" },
  critical: { label: "Critical Risk", color: "text-red-600", bg: "bg-red-100", border: "border-red-500" },
};

// Prediction types
interface HealthPrediction {
  id: string;
  animalId: string;
  animalTag: string;
  condition: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  probability: number;
  factors: string[];
  recommendations: string[];
  timeframe: string;
  category: "disease" | "metabolic" | "reproductive" | "lameness" | "mastitis" | "general";
}

// AI prediction algorithms (simplified rule-based for demo)
function generatePredictions(
  animals: Animal[],
  treatments: AnimalTreatment[],
  weightRecords: WeightRecord[],
  healthScores: HealthScore[]
): HealthPrediction[] {
  const predictions: HealthPrediction[] = [];

  animals.forEach((animal) => {
    if (animal.status !== "active") return;

    const animalTreatments = treatments.filter(t => t.animalId === animal.id);
    const animalWeights = weightRecords.filter(w => w.animalId === animal.id);
    const animalScores = healthScores.filter(s => s.animalId === animal.id);
    const animalTag = animal.cowId || animal.naitTag || animal.id.slice(0, 8);

    // 1. Mastitis Risk Prediction
    const mastitisTreatments = animalTreatments.filter(t => 
      t.condition?.toLowerCase().includes("mastitis")
    );
    const recentMastitis = mastitisTreatments.filter(t => {
      const treatmentDate = new Date(t.dateTime);
      return differenceInDays(new Date(), treatmentDate) < 90;
    });

    if (recentMastitis.length >= 2) {
      predictions.push({
        id: `${animal.id}-mastitis`,
        animalId: animal.id,
        animalTag,
        condition: "Recurring Mastitis",
        riskLevel: recentMastitis.length >= 3 ? "critical" : "high",
        probability: Math.min(60 + recentMastitis.length * 15, 95),
        factors: [
          `${recentMastitis.length} mastitis cases in last 90 days`,
          "History of udder infections",
          "Potential chronic infection",
        ],
        recommendations: [
          "Review milking hygiene protocols",
          "Consider dry cow therapy",
          "Consult veterinarian for culture and sensitivity",
          "Monitor SCC closely",
        ],
        timeframe: "Next 30 days",
        category: "mastitis",
      });
    } else if (mastitisTreatments.length > 0) {
      predictions.push({
        id: `${animal.id}-mastitis-watch`,
        animalId: animal.id,
        animalTag,
        condition: "Mastitis Watch",
        riskLevel: "moderate",
        probability: 35,
        factors: [
          "Previous mastitis history",
          "Monitor for early signs",
        ],
        recommendations: [
          "Regular teat dipping",
          "Monitor milk appearance",
          "Check SCC at next herd test",
        ],
        timeframe: "Next 60 days",
        category: "mastitis",
      });
    }

    // 2. Lameness Risk Prediction
    const lamenessTreatments = animalTreatments.filter(t => 
      t.condition?.toLowerCase().includes("lame") || 
      t.bodyPart?.toLowerCase().includes("foot") ||
      t.bodyPart?.toLowerCase().includes("hoof")
    );
    const latestScore = animalScores.sort((a, b) => 
      new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime()
    )[0];
    const lamenessScore = latestScore?.lamenessScore ? parseInt(latestScore.lamenessScore) : 0;

    if (lamenessScore >= 3 || lamenessTreatments.length >= 2) {
      predictions.push({
        id: `${animal.id}-lameness`,
        animalId: animal.id,
        animalTag,
        condition: "Lameness Risk",
        riskLevel: lamenessScore >= 4 ? "high" : "moderate",
        probability: 40 + lamenessScore * 10 + lamenessTreatments.length * 5,
        factors: [
          lamenessScore > 0 ? `Current lameness score: ${lamenessScore}` : null,
          lamenessTreatments.length > 0 ? `${lamenessTreatments.length} previous foot treatments` : null,
          "Track conditions may contribute",
        ].filter(Boolean) as string[],
        recommendations: [
          "Schedule hoof trimming",
          "Review track and yard surfaces",
          "Consider footbathing program",
          "Monitor mobility daily",
        ],
        timeframe: "Next 14 days",
        category: "lameness",
      });
    }

    // 3. Weight Loss / Metabolic Risk
    if (animalWeights.length >= 2) {
      const sortedWeights = [...animalWeights].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const latestWeight = parseFloat(sortedWeights[0]?.weight || "0");
      const previousWeight = parseFloat(sortedWeights[1]?.weight || "0");
      const weightChange = previousWeight > 0 ? ((latestWeight - previousWeight) / previousWeight) * 100 : 0;

      if (weightChange < -5) {
        predictions.push({
          id: `${animal.id}-weight`,
          animalId: animal.id,
          animalTag,
          condition: "Significant Weight Loss",
          riskLevel: weightChange < -10 ? "high" : "moderate",
          probability: Math.min(50 + Math.abs(weightChange) * 3, 90),
          factors: [
            `${Math.abs(weightChange).toFixed(1)}% weight loss detected`,
            `Current: ${latestWeight}kg, Previous: ${previousWeight}kg`,
            "May indicate underlying health issue",
          ],
          recommendations: [
            "Investigate feed intake",
            "Check for parasites (FEC)",
            "Assess body condition score",
            "Consider veterinary examination",
          ],
          timeframe: "Immediate attention",
          category: "metabolic",
        });
      }
    }

    // 4. BCS Risk
    const bcs = latestScore?.bodyConditionScore ? parseFloat(String(latestScore.bodyConditionScore)) : 0;
    if (bcs > 0 && (bcs < 4.0 || bcs > 6.0)) {
      predictions.push({
        id: `${animal.id}-bcs`,
        animalId: animal.id,
        animalTag,
        condition: bcs < 4.0 ? "Low Body Condition" : "Over-conditioned",
        riskLevel: bcs < 3.5 || bcs > 6.5 ? "high" : "moderate",
        probability: 45,
        factors: [
          `Current BCS: ${bcs.toFixed(1)}`,
          bcs < 4.0 ? "Risk of metabolic issues" : "Risk of calving difficulties",
          "May affect production and fertility",
        ],
        recommendations: bcs < 4.0 ? [
          "Increase energy intake",
          "Review feed quality",
          "Check for underlying disease",
        ] : [
          "Reduce energy intake gradually",
          "Increase exercise if possible",
          "Monitor closely pre-calving",
        ],
        timeframe: "Next 30 days",
        category: "metabolic",
      });
    }

    // 5. Reproductive Risk (based on age and history)
    const age = animal.dateOfBirth 
      ? differenceInDays(new Date(), new Date(animal.dateOfBirth)) / 365 
      : 0;
    
    if (age > 8 && animal.sex === "female") {
      predictions.push({
        id: `${animal.id}-repro`,
        animalId: animal.id,
        animalTag,
        condition: "Age-related Fertility Decline",
        riskLevel: age > 10 ? "moderate" : "low",
        probability: 25 + (age - 8) * 5,
        factors: [
          `Age: ${age.toFixed(1)} years`,
          "Older cows may have reduced conception rates",
          "Consider replacement planning",
        ],
        recommendations: [
          "Monitor heat detection closely",
          "Consider early AI timing",
          "Evaluate for culling decision",
        ],
        timeframe: "Next breeding season",
        category: "reproductive",
      });
    }

    // 6. Treatment Pattern Analysis
    const recentTreatments = animalTreatments.filter(t => {
      const treatmentDate = new Date(t.dateTime);
      return differenceInDays(new Date(), treatmentDate) < 180;
    });

    if (recentTreatments.length >= 4) {
      const conditions = Array.from(new Set(recentTreatments.map(t => t.condition).filter(Boolean)));
      predictions.push({
        id: `${animal.id}-frequent`,
        animalId: animal.id,
        animalTag,
        condition: "Frequent Health Issues",
        riskLevel: recentTreatments.length >= 6 ? "high" : "moderate",
        probability: 55,
        factors: [
          `${recentTreatments.length} treatments in last 6 months`,
          `Conditions: ${conditions.slice(0, 3).join(", ")}`,
          "May indicate compromised immunity",
        ],
        recommendations: [
          "Comprehensive health assessment",
          "Review nutrition program",
          "Consider trace element testing",
          "Evaluate culling economics",
        ],
        timeframe: "Ongoing monitoring",
        category: "general",
      });
    }
  });

  // Sort by risk level and probability
  const riskOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
  return predictions.sort((a, b) => {
    const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return b.probability - a.probability;
  });
}

export default function HealthPredictionsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPrediction, setSelectedPrediction] = useState<HealthPrediction | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch animals
  const { data: animals = [], isLoading: loadingAnimals } = useQuery<Animal[]>({
    queryKey: ["/api/animals"],
    queryFn: async () => {
      const res = await fetch("/api/animals");
      if (!res.ok) throw new Error("Failed to fetch animals");
      return res.json();
    },
  });

  // Fetch treatments
  const { data: treatments = [] } = useQuery<AnimalTreatment[]>({
    queryKey: ["/api/treatments"],
    queryFn: async () => {
      const res = await fetch("/api/treatments");
      if (!res.ok) throw new Error("Failed to fetch treatments");
      return res.json();
    },
  });

  // Fetch weight records
  const { data: weightRecords = [] } = useQuery<WeightRecord[]>({
    queryKey: ["/api/weight/records"],
    queryFn: async () => {
      const res = await fetch("/api/weight/records");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch health scores
  const { data: healthScores = [] } = useQuery<HealthScore[]>({
    queryKey: ["/api/health-monitoring/scores"],
    queryFn: async () => {
      const res = await fetch("/api/health-monitoring/scores");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Generate predictions
  const predictions = useMemo(() => {
    if (animals.length === 0) return [];
    return generatePredictions(animals, treatments, weightRecords, healthScores);
  }, [animals, treatments, weightRecords, healthScores]);

  // Filter predictions
  const filteredPredictions = useMemo(() => {
    if (selectedCategory === "all") return predictions;
    return predictions.filter(p => p.category === selectedCategory);
  }, [predictions, selectedCategory]);

  // Summary stats
  const criticalCount = predictions.filter(p => p.riskLevel === "critical").length;
  const highCount = predictions.filter(p => p.riskLevel === "high").length;
  const moderateCount = predictions.filter(p => p.riskLevel === "moderate").length;
  const lowCount = predictions.filter(p => p.riskLevel === "low").length;

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    predictions.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [predictions]);

  const isLoading = loadingAnimals;

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "mastitis": return <Droplets className="h-4 w-4" />;
      case "lameness": return <Bone className="h-4 w-4" />;
      case "metabolic": return <Activity className="h-4 w-4" />;
      case "reproductive": return <Baby className="h-4 w-4" />;
      case "disease": return <Bug className="h-4 w-4" />;
      default: return <Heart className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-600" />
            AI Health Predictions
          </h1>
          <p className="text-muted-foreground mt-1">
            Predictive analytics to identify animals at risk before problems occur
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          AI-Powered
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Risk</p>
                <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                <p className="text-3xl font-bold text-orange-600">{highCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Moderate Risk</p>
                <p className="text-3xl font-bold text-yellow-600">{moderateCount}</p>
              </div>
              <Info className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Risk</p>
                <p className="text-3xl font-bold text-green-600">{lowCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Predictions</p>
                <p className="text-3xl font-bold text-purple-600">{predictions.length}</p>
              </div>
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Filter by category:</span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            All ({predictions.length})
          </Button>
          <Button
            variant={selectedCategory === "mastitis" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("mastitis")}
          >
            <Droplets className="h-4 w-4 mr-1" />
            Mastitis ({categoryCounts.mastitis || 0})
          </Button>
          <Button
            variant={selectedCategory === "lameness" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("lameness")}
          >
            <Bone className="h-4 w-4 mr-1" />
            Lameness ({categoryCounts.lameness || 0})
          </Button>
          <Button
            variant={selectedCategory === "metabolic" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("metabolic")}
          >
            <Activity className="h-4 w-4 mr-1" />
            Metabolic ({categoryCounts.metabolic || 0})
          </Button>
          <Button
            variant={selectedCategory === "reproductive" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("reproductive")}
          >
            <Baby className="h-4 w-4 mr-1" />
            Reproductive ({categoryCounts.reproductive || 0})
          </Button>
          <Button
            variant={selectedCategory === "general" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("general")}
          >
            <Heart className="h-4 w-4 mr-1" />
            General ({categoryCounts.general || 0})
          </Button>
        </div>
      </div>

      {/* Predictions List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Analyzing health data...</p>
          </CardContent>
        </Card>
      ) : filteredPredictions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No health risks predicted</p>
            <p className="text-sm mt-2">
              {animals.length === 0 
                ? "Add animals to start generating predictions"
                : "All animals appear healthy based on current data"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPredictions.map((prediction) => {
            const risk = RISK_LEVELS[prediction.riskLevel];
            return (
              <Card 
                key={prediction.id}
                className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${risk.border}`}
                onClick={() => {
                  setSelectedPrediction(prediction);
                  setShowDetailDialog(true);
                }}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${risk.bg}`}>
                        {getCategoryIcon(prediction.category)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{prediction.animalTag}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {prediction.category}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mt-1">{prediction.condition}</p>
                        <p className="text-xs text-muted-foreground">
                          {prediction.timeframe}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge className={`${risk.bg} ${risk.color} border-0`}>
                          {risk.label}
                        </Badge>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={prediction.probability} className="w-24 h-2" />
                          <span className="text-sm font-medium">{prediction.probability}%</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How AI Predictions Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Data Analysis</p>
                <p className="text-sm text-muted-foreground">
                  Analyzes treatment history, weight trends, health scores, and age to identify patterns
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Risk Assessment</p>
                <p className="text-sm text-muted-foreground">
                  Calculates probability scores based on multiple risk factors and historical data
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Preventive Action</p>
                <p className="text-sm text-muted-foreground">
                  Provides actionable recommendations to prevent health issues before they occur
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Health Prediction Details
            </DialogTitle>
          </DialogHeader>
          {selectedPrediction && (
            <div className="space-y-4">
              {/* Animal & Condition */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-lg">{selectedPrediction.animalTag}</p>
                  <p className="text-sm text-muted-foreground">{selectedPrediction.condition}</p>
                </div>
                <Badge className={`${RISK_LEVELS[selectedPrediction.riskLevel].bg} ${RISK_LEVELS[selectedPrediction.riskLevel].color} border-0`}>
                  {RISK_LEVELS[selectedPrediction.riskLevel].label}
                </Badge>
              </div>

              {/* Probability */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Risk Probability</span>
                  <span className="font-medium">{selectedPrediction.probability}%</span>
                </div>
                <Progress value={selectedPrediction.probability} className="h-3" />
              </div>

              {/* Timeframe */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Timeframe: <strong>{selectedPrediction.timeframe}</strong></span>
              </div>

              {/* Risk Factors */}
              <div>
                <p className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Risk Factors
                </p>
                <ul className="space-y-1">
                  {selectedPrediction.factors.map((factor, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-orange-500 mt-1">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div>
                <p className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Recommended Actions
                </p>
                <ul className="space-y-1">
                  {selectedPrediction.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" variant="outline">
                  View Animal
                </Button>
                <Button className="flex-1">
                  Create Treatment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
