import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AnimalTreatment } from "@shared/schema";
import { CheckCircle2, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

type CompletedTreatmentsProps = {
  treatments: AnimalTreatment[];
};

export default function CompletedTreatments({ treatments }: CompletedTreatmentsProps) {
  const [search, setSearch] = useState("");
  
  const completedTreatments = treatments.filter(t => t.status === 'completed');
  
  const filteredTreatments = completedTreatments.filter((treatment) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const cowId = treatment.cowId?.toLowerCase() || '';
    const birthId = treatment.birthId 
      ? `${treatment.birthId.participantCode}${treatment.birthId.year}-${treatment.birthId.number}`.toLowerCase()
      : '';
    const condition = treatment.condition?.toLowerCase() || '';
    const staff = treatment.staffMember?.toLowerCase() || '';
    const notes = treatment.returnToHerdNotes?.toLowerCase() || '';
    const treatmentType = treatment.treatmentType?.toLowerCase() || '';
    
    return cowId.includes(searchLower) ||
           birthId.includes(searchLower) ||
           condition.includes(searchLower) ||
           staff.includes(searchLower) ||
           notes.includes(searchLower) ||
           treatmentType.includes(searchLower);
  });

  const getCowIdentifier = (treatment: AnimalTreatment): string => {
    if (treatment.cowId) return `Cow ${treatment.cowId}`;
    if (treatment.birthId) {
      return `${treatment.birthId.participantCode}${treatment.birthId.year}-${treatment.birthId.number}`;
    }
    return "Unknown Cow";
  };

  if (completedTreatments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No completed treatments
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="list-completed-treatments">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by cow ID, condition, staff, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-completed"
        />
      </div>
      
      {filteredTreatments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No treatments match your search
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTreatments.map((treatment) => (
        <Card key={treatment.id} data-testid={`card-completed-${treatment.id}`}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold" data-testid="text-cow-id">
                    {getCowIdentifier(treatment)}
                  </h3>
                  {treatment.returnedToHerd && (
                    <Badge className="bg-pulse-forest" data-testid="badge-returned-to-herd">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Returned to Herd
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{treatment.condition}</p>
                {treatment.bodyPart && (
                  <p className="text-xs text-muted-foreground">{treatment.bodyPart}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {treatment.completedDate && format(new Date(treatment.completedDate), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {treatment.staffMember}
                </p>
              </div>
            </div>

            {treatment.returnedToHerd && treatment.returnToHerdNotes ? (
              <div className="mt-3 p-3 bg-muted rounded-md" data-testid="section-return-to-herd-notes">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Observation Notes:</p>
                    <p className="text-sm text-muted-foreground">{treatment.returnToHerdNotes}</p>
                    <p className="text-xs text-muted-foreground italic mt-2">No treatment administered</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-2">
                  <p className="text-sm font-medium">
                    {treatment.treatmentType || "No treatment administered"}
                  </p>
                  {treatment.treatmentPlan && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {treatment.treatmentPlan}
                    </p>
                  )}
                </div>
                {treatment.clinicalNotes && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground italic">
                      {treatment.clinicalNotes}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        ))}
        </div>
      )}
    </div>
  );
}
