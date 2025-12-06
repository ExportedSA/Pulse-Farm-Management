import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Syringe, AlertCircle, CheckCircle2, Clock, Eye } from "lucide-react";
import type { AnimalTreatment, Product } from "@shared/schema";
import { getTreatmentPhase, type TreatmentPhase } from "@/pages/home";
import { daysUntil } from "@/lib/utils";

type CurrentTreatmentsProps = {
  treatments: AnimalTreatment[];
  products: Product[];
  onAdministerDose: (treatmentId: string) => void;
  onRetreat: (treatmentId: string, reason: string) => void;
  onReturnToVat: (treatmentId: string) => void;
  onResumeTreatment: (treatmentId: string) => void;
  onStartMonitoring: (treatmentId: string, days: number) => void;
  onCompleteMonitoring: (treatmentId: string) => void;
  onReturnToHerd: (treatmentId: string, notes: string) => void;
  initialPhase?: TreatmentPhase;
  lockedPhase?: TreatmentPhase;
  onPhaseChange?: (phase: TreatmentPhase) => void;
};

export default function CurrentTreatments({
  treatments,
  products,
  onAdministerDose,
  onRetreat,
  onReturnToVat,
  onResumeTreatment,
  onStartMonitoring,
  onCompleteMonitoring,
  onReturnToHerd,
  initialPhase = 'treatment',
  lockedPhase,
  onPhaseChange,
}: CurrentTreatmentsProps) {
  const [activeTab, setActiveTab] = useState<TreatmentPhase>(initialPhase);

  const handleTabChange = (phase: TreatmentPhase) => {
    if (lockedPhase) return; // Prevent tab changes when locked
    setActiveTab(phase);
    onPhaseChange?.(phase);
  };
  const [selectedTreatment, setSelectedTreatment] = useState<AnimalTreatment | null>(null);
  const [showRetreatDialog, setShowRetreatDialog] = useState(false);
  const [retreatReason, setRetreatReason] = useState("");
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [monitoringDays, setMonitoringDays] = useState<string>("");
  const [showReturnToHerdDialog, setShowReturnToHerdDialog] = useState(false);
  const [returnToHerdNotes, setReturnToHerdNotes] = useState("");

  const getCowIdentifier = (treatment: AnimalTreatment): string => {
    if (treatment.cowId) return `Cow ${treatment.cowId}`;
    if (treatment.birthId) {
      return `${treatment.birthId.participantCode}${treatment.birthId.year}-${treatment.birthId.number}`;
    }
    return "Unknown Cow";
  };

  const effectiveTab = lockedPhase || activeTab;

  const filteredTreatments = treatments.filter(
    t => t.status === 'active' && getTreatmentPhase(t) === effectiveTab
  );

  const handleAdminister = (treatment: AnimalTreatment) => {
    onAdministerDose(treatment.id);
    setSelectedTreatment(null);
  };

  const handleRetreatSubmit = () => {
    if (selectedTreatment && retreatReason.trim()) {
      onRetreat(selectedTreatment.id, retreatReason);
      setShowRetreatDialog(false);
      setRetreatReason("");
      setSelectedTreatment(null);
    }
  };

  const handleReturnToVat = (treatment: AnimalTreatment) => {
    onReturnToVat(treatment.id);
    setSelectedTreatment(null);
  };

  const handleStartMonitoring = () => {
    if (selectedTreatment && monitoringDays.trim()) {
      const days = parseInt(monitoringDays, 10);
      if (days > 0) {
        onStartMonitoring(selectedTreatment.id, days);
        setShowMonitoringDialog(false);
        setMonitoringDays("");
        setSelectedTreatment(null);
      }
    }
  };

  const handleReturnToHerd = () => {
    if (selectedTreatment && returnToHerdNotes.trim()) {
      onReturnToHerd(selectedTreatment.id, returnToHerdNotes);
      setShowReturnToHerdDialog(false);
      setReturnToHerdNotes("");
      setSelectedTreatment(null);
    }
  };

  const renderTreatmentCard = (treatment: AnimalTreatment) => {
    const dosesGiven = treatment.dosesGiven || 0;
    const totalDoses = treatment.totalDoses || 1;
    const dosesLeft = totalDoses - dosesGiven;
    const status = getTreatmentPhase(treatment);
    
    let daysLeftText = "";
    if (status === 'withholding' && treatment.milkWithdrawalEndDate) {
      const days = daysUntil(treatment.milkWithdrawalEndDate);
      daysLeftText = `${days} day${days !== 1 ? 's' : ''} until clear`;
    }

    return (
      <Card 
        key={treatment.id} 
        className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.01]"
        onClick={() => setSelectedTreatment(treatment)}
        data-testid={`card-treatment-${treatment.id}`}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold" data-testid="text-cow-id">
                {getCowIdentifier(treatment)}
              </h3>
              <p className="text-sm text-muted-foreground">{treatment.condition}</p>
              {treatment.bodyPart && (
                <p className="text-xs text-muted-foreground">
                  {treatment.bodyPart}
                </p>
              )}
            </div>
            {status === 'awaiting' && (
              <Badge className="bg-pulse-700" data-testid="badge-awaiting">
                Needs Plan
              </Badge>
            )}
            {status === 'treatment' && (
              <Badge variant="destructive" data-testid="badge-doses-left">
                {dosesLeft} dose{dosesLeft !== 1 ? 's' : ''} left
              </Badge>
            )}
            {status === 'withholding' && (
              <Badge className="bg-pulse-500" data-testid="badge-withholding">
                {daysLeftText}
              </Badge>
            )}
            {status === 'monitoring' && treatment.monitoringEndDate && (
              <Badge className="bg-pulse-gold" data-testid="badge-monitoring">
                {daysUntil(treatment.monitoringEndDate)} day{daysUntil(treatment.monitoringEndDate) !== 1 ? 's' : ''} left
              </Badge>
            )}
            {status === 'returnToVat' && (
              <Badge className="bg-pulse-forest" data-testid="badge-clear">
                Clear
              </Badge>
            )}
          </div>
          <div className="mt-2">
            <p className="text-sm font-medium">{treatment.treatmentType}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {treatment.treatmentPlan}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDetailDialog = () => {
    if (!selectedTreatment) return null;

    const status = getTreatmentPhase(selectedTreatment);
    const dosesGiven = selectedTreatment.dosesGiven || 0;
    const totalDoses = selectedTreatment.totalDoses || 1;

    return (
      <Dialog open={!!selectedTreatment} onOpenChange={() => setSelectedTreatment(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-treatment-detail">
          <DialogHeader>
            <DialogTitle className="text-xl">{getCowIdentifier(selectedTreatment)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <p className="text-base font-medium mb-1">Condition</p>
              <p className="text-base text-muted-foreground">{selectedTreatment.condition}</p>
              {selectedTreatment.bodyPart && (
                <p className="text-sm text-muted-foreground mt-1">Affected: {selectedTreatment.bodyPart}</p>
              )}
            </div>
            <div>
              <p className="text-base font-medium mb-1">Treatment</p>
              <p className="text-base text-muted-foreground">{selectedTreatment.treatmentType}</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedTreatment.treatmentPlan}</p>
            </div>
            {status === 'treatment' && (
              <div>
                <p className="text-base font-medium mb-1">Progress</p>
                <p className="text-base text-muted-foreground">
                  {dosesGiven} of {totalDoses} doses administered
                </p>
              </div>
            )}
            {status === 'monitoring' && selectedTreatment.monitoringEndDate && (
              <div>
                <p className="text-base font-medium mb-1">Monitoring Period</p>
                <p className="text-base text-muted-foreground">
                  {daysUntil(selectedTreatment.monitoringEndDate)} day{daysUntil(selectedTreatment.monitoringEndDate) !== 1 ? 's' : ''} remaining
                </p>
              </div>
            )}
            {selectedTreatment.clinicalNotes && (
              <div>
                <p className="text-base font-medium mb-1">Notes</p>
                <p className="text-base text-muted-foreground">{selectedTreatment.clinicalNotes}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              {status === 'awaiting' && (
                <>
                  <Button
                    onClick={() => {
                      onResumeTreatment(selectedTreatment.id);
                      setSelectedTreatment(null);
                    }}
                    size="lg"
                    className="w-full h-12 text-base"
                    data-testid="button-start-treatment"
                  >
                    <Syringe className="w-5 h-5 mr-2" />
                    Start Treatment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowReturnToHerdDialog(true);
                    }}
                    size="lg"
                    className="w-full h-12 text-base"
                    data-testid="button-return-to-herd"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Return to Herd
                  </Button>
                </>
              )}
              {status === 'treatment' && (
                <>
                  <Button
                    onClick={() => handleAdminister(selectedTreatment)}
                    size="lg"
                    className="w-full h-12 text-base"
                    data-testid="button-administer"
                  >
                    <Syringe className="w-5 h-5 mr-2" />
                    Administer Dose
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowMonitoringDialog(true)}
                    size="lg"
                    className="w-full h-12 text-base"
                    data-testid="button-start-monitoring"
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    Monitor
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRetreatDialog(true);
                    }}
                    size="lg"
                    className="w-full h-14 text-base border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    data-testid="button-retreat"
                  >
                    Retreat
                  </Button>
                </>
              )}
              {status === 'withholding' && (
                <Button
                  variant="outline"
                  onClick={() => setShowRetreatDialog(true)}
                  size="lg"
                  className="w-full h-14 text-base border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  data-testid="button-retreat"
                >
                  Retreat
                </Button>
              )}
              {status === 'monitoring' && (
                <>
                  <Button
                    onClick={() => {
                      onResumeTreatment(selectedTreatment.id);
                      setSelectedTreatment(null);
                    }}
                    size="lg"
                    className="w-full h-12 text-base"
                    data-testid="button-convert-to-treatment"
                  >
                    <Syringe className="w-5 h-5 mr-2" />
                    Treat
                  </Button>
                  <Button
                    onClick={() => {
                      onCompleteMonitoring(selectedTreatment.id);
                      setSelectedTreatment(null);
                    }}
                    size="lg"
                    className="w-full h-12 text-base bg-pulse-forest hover:bg-pulse-forest-dark"
                    data-testid="button-complete-monitoring"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Complete
                  </Button>
                </>
              )}
              {status === 'returnToVat' && (
                <>
                  <Button
                    onClick={() => handleReturnToVat(selectedTreatment)}
                    size="lg"
                    className="w-full h-12 text-base bg-pulse-forest hover:bg-pulse-forest-dark"
                    data-testid="button-return-to-vat"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Return to Vat
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRetreatDialog(true)}
                    size="lg"
                    className="w-full h-14 text-base border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    data-testid="button-retreat"
                  >
                    Retreat
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderRetreatDialog = () => (
    <Dialog open={showRetreatDialog} onOpenChange={setShowRetreatDialog}>
      <DialogContent className="max-w-lg" data-testid="dialog-retreat">
        <DialogHeader>
          <DialogTitle className="text-xl">Retreat Cow</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div>
            <p className="text-base text-muted-foreground mb-3">
              Starting a new treatment will override the current treatment's withdrawal and return-to-vat schedule.
              The previous treatment will be saved in history.
            </p>
            <label className="text-base font-medium">Reason for Retreat *</label>
            <Textarea
              value={retreatReason}
              onChange={(e) => setRetreatReason(e.target.value)}
              placeholder="e.g., Treatment not effective, condition worsened, new symptoms appeared..."
              rows={4}
              className="mt-2 text-base"
              data-testid="input-retreat-reason"
            />
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleRetreatSubmit}
              disabled={!retreatReason.trim()}
              size="lg"
              className="w-full h-12 text-base"
              data-testid="button-confirm-retreat"
            >
              Confirm Retreat
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowRetreatDialog(false);
                setRetreatReason("");
              }}
              size="lg"
              className="w-full h-12 text-base"
              data-testid="button-cancel-retreat"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderMonitoringDialog = () => (
    <Dialog open={showMonitoringDialog} onOpenChange={setShowMonitoringDialog}>
      <DialogContent className="max-w-lg" data-testid="dialog-start-monitoring">
        <DialogHeader>
          <DialogTitle className="text-xl">Start Monitoring Period</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div>
            <p className="text-base text-muted-foreground mb-4">
              Monitor this cow for a specified number of days without treatment.
              Use this for observation periods after initial treatment or for conditions requiring watchful waiting.
            </p>
            <label className="text-base font-medium">Monitoring Days *</label>
            <input
              type="number"
              min="1"
              value={monitoringDays}
              onChange={(e) => setMonitoringDays(e.target.value)}
              placeholder="e.g., 3, 7, 14..."
              className="w-full mt-2 px-4 py-3 border rounded-md text-base h-14"
              data-testid="input-monitoring-days"
            />
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleStartMonitoring}
              disabled={!monitoringDays.trim() || parseInt(monitoringDays) < 1}
              size="lg"
              className="w-full h-12 text-base"
              data-testid="button-confirm-monitoring"
            >
              Start Monitoring
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowMonitoringDialog(false);
                setMonitoringDays("");
              }}
              size="lg"
              className="w-full h-12 text-base"
              data-testid="button-cancel-monitoring"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderReturnToHerdDialog = () => (
    <Dialog open={showReturnToHerdDialog} onOpenChange={setShowReturnToHerdDialog}>
      <DialogContent className="max-w-lg" data-testid="dialog-return-to-herd">
        <DialogHeader>
          <DialogTitle className="text-xl">Return to Herd</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div>
            <p className="text-base text-muted-foreground mb-4">
              This cow was checked but requires no treatment and can return to the herd.
              Please provide notes explaining the observation for future reference.
            </p>
            <label className="text-base font-medium">Observation Notes *</label>
            <Textarea
              value={returnToHerdNotes}
              onChange={(e) => setReturnToHerdNotes(e.target.value)}
              placeholder="e.g., False alarm, minor issue resolved on its own, no symptoms observed..."
              rows={4}
              className="mt-2 text-base"
              data-testid="input-return-to-herd-notes"
            />
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleReturnToHerd}
              disabled={!returnToHerdNotes.trim()}
              size="lg"
              className="w-full h-12 text-base"
              data-testid="button-confirm-return-to-herd"
            >
              Confirm Return
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowReturnToHerdDialog(false);
                setReturnToHerdNotes("");
              }}
              size="lg"
              className="w-full h-12 text-base"
              data-testid="button-cancel-return-to-herd"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const awaitingCount = treatments.filter(t => t.status === 'active' && getTreatmentPhase(t) === 'awaiting').length;
  const treatmentCount = treatments.filter(t => t.status === 'active' && getTreatmentPhase(t) === 'treatment').length;
  const withholdingCount = treatments.filter(t => t.status === 'active' && getTreatmentPhase(t) === 'withholding').length;
  const monitoringCount = treatments.filter(t => t.status === 'active' && getTreatmentPhase(t) === 'monitoring').length;
  const returnToVatCount = treatments.filter(t => t.status === 'active' && getTreatmentPhase(t) === 'returnToVat').length;

  const phaseOptions = [
    { 
      value: 'awaiting' as TreatmentPhase, 
      label: 'Awaiting', 
      count: awaitingCount,
      icon: Clock,
      description: 'Need treatment plan',
      color: 'text-gray-600'
    },
    { 
      value: 'treatment' as TreatmentPhase, 
      label: 'Treatment', 
      count: treatmentCount,
      icon: Syringe,
      description: 'Cows receiving doses',
      color: 'text-red-600'
    },
    { 
      value: 'withholding' as TreatmentPhase, 
      label: 'Withholding', 
      count: withholdingCount,
      icon: AlertCircle,
      description: 'Awaiting clearance',
      color: 'text-blue-600'
    },
    { 
      value: 'monitoring' as TreatmentPhase, 
      label: 'Monitoring', 
      count: monitoringCount,
      icon: Eye,
      description: 'Under observation',
      color: 'text-yellow-600'
    },
    { 
      value: 'returnToVat' as TreatmentPhase, 
      label: 'Return to Vat', 
      count: returnToVatCount,
      icon: CheckCircle2,
      description: 'Ready to return',
      color: 'text-green-600'
    }
  ];

  const selectedPhase = phaseOptions.find(p => p.value === effectiveTab);

  return (
    <div className="space-y-4" data-testid="container-current-treatments">
      {!lockedPhase && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-base font-medium whitespace-nowrap">Filter by Phase:</label>
              <Select 
                value={effectiveTab} 
                onValueChange={(value) => handleTabChange(value as TreatmentPhase)}
              >
                <SelectTrigger className="w-full sm:flex-1 h-14" data-testid="select-phase-trigger">
                  <SelectValue>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5">
                        {selectedPhase && (
                          <>
                            <selectedPhase.icon className={`w-5 h-5 ${selectedPhase.color}`} />
                            <span className="font-medium text-base">{selectedPhase.label}</span>
                          </>
                        )}
                      </div>
                      <Badge variant="secondary" className="ml-2 text-sm">
                        {selectedPhase?.count || 0}
                      </Badge>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {phaseOptions.map((phase) => {
                    const Icon = phase.icon;
                    return (
                      <SelectItem 
                        key={phase.value} 
                        value={phase.value}
                        data-testid={`select-phase-${phase.value}`}
                        className="py-3"
                      >
                        <div className="flex items-center justify-between w-full gap-4">
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-5 h-5 ${phase.color}`} />
                            <div className="flex flex-col">
                              <span className="font-medium text-base">{phase.label}</span>
                              <span className="text-sm text-muted-foreground">{phase.description}</span>
                            </div>
                          </div>
                          <Badge variant="secondary" className="ml-auto text-sm">
                            {phase.count}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filteredTreatments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No cows in this category
            </CardContent>
          </Card>
        ) : (
          filteredTreatments.map(renderTreatmentCard)
        )}
      </div>

      {renderDetailDialog()}
      {renderRetreatDialog()}
      {renderMonitoringDialog()}
      {renderReturnToHerdDialog()}
    </div>
  );
}
