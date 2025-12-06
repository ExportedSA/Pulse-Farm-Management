import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Syringe } from "lucide-react";

export default function TreatmentPanel() {
  return (
    <Card data-testid="card-treatment">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Syringe className="w-5 h-5" />
          Animal Treatment
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
