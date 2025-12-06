import { useState, useEffect } from 'react';
import { pulseGet, pulsePost, pulsePatch } from '@/lib/pulseApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, FileText, BookOpen, FolderOpen, Users, Plus, Shield, UserX, Bell } from 'lucide-react';
import ComplianceDocsPage from './compliance-docs';
import DigitalRegistry from '@/components/DigitalRegistry';
import HazardIdentificationForm from '@/components/HazardIdentificationForm';
import IncidentReportingForm from '@/components/IncidentReportingForm';
import DynamicFormGenerator from '@/components/DynamicFormGenerator';
import BiosecurityManagement from '@/components/BiosecurityManagement';
import LoneWorkerSafety from '@/components/LoneWorkerSafety';
import ContractorDocumentTracker from '@/components/ContractorDocumentTracker';
import NotificationService from '@/components/NotificationService';
import FarmInductionModule from '@/components/FarmInductionModule';

interface Hazard {
  id: string;
  title: string;
  description: string;
  type: string;
  riskLevel: string;
  active: boolean;
  createdAt: string;
}

interface Incident {
  id: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  occurredAt: string;
  createdAt: string;
}

export default function CompliancePage() {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [peopleOnSite, setPeopleOnSite] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeHazardView, setActiveHazardView] = useState<'list' | 'form'>('list');
  const [activeIncidentView, setActiveIncidentView] = useState<'list' | 'form'>('list');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [documentationView, setDocumentationView] = useState<'forms' | 'tracker' | 'list'>('forms');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [hazardsData, incidentsData] = await Promise.all([
        pulseGet<Hazard[]>('/compliance/hazards'),
        pulseGet<Incident[]>('/compliance/incidents'),
      ]);
      setHazards(hazardsData);
      setIncidents(incidentsData);
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveHazard(hazardId: string) {
    try {
      await pulsePost(`/compliance/hazards/${hazardId}/resolve`);
      loadData();
    } catch (err) {
      console.error('Failed to resolve hazard:', err);
    }
  }

  async function handleUpdateIncidentStatus(incidentId: string, status: string) {
    try {
      await pulsePatch(`/compliance/incidents/${incidentId}/status`, { status });
      loadData();
    } catch (err) {
      console.error('Failed to update incident:', err);
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'destructive';
      case 'HIGH':
        return 'default';
      case 'MEDIUM':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return <div className="p-8">Loading compliance data...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">H&S Compliance</h1>
        <p className="text-muted-foreground mt-2">
          Manage workplace hazards, incidents, and staff safety
        </p>
      </div>

      <Tabs defaultValue="hazards" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="hazards">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Hazards ({hazards.filter(h => h.active).length})
          </TabsTrigger>
          <TabsTrigger value="incidents">
            <FileText className="h-4 w-4 mr-2" />
            Incidents ({incidents.filter(i => i.status === 'OPEN').length})
          </TabsTrigger>
          <TabsTrigger value="documentation">
            <FolderOpen className="h-4 w-4 mr-2" />
            Documentation
          </TabsTrigger>
          <TabsTrigger value="lone_workers">
            <UserX className="h-4 w-4 mr-2" />
            Lone Workers
          </TabsTrigger>
          <TabsTrigger value="registry">
            <Users className="h-4 w-4 mr-2" />
            Registry ({peopleOnSite.filter(p => p.status === 'on_site').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hazards" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={activeHazardView === 'list' ? 'default' : 'outline'}
                onClick={() => setActiveHazardView('list')}
                className={activeHazardView === 'list' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
              >
                All Hazards ({hazards.filter(h => h.active).length})
              </Button>
              <Button
                variant={activeHazardView === 'form' ? 'default' : 'outline'}
                onClick={() => setActiveHazardView('form')}
                className={activeHazardView === 'form' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </div>
          </div>

          {activeHazardView === 'list' ? (
            hazards.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No hazards reported
              </Card>
            ) : (
              hazards.map(hazard => (
                <Card key={hazard.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{hazard.title}</h3>
                        <Badge variant={getRiskColor(hazard.riskLevel) as any}>
                          {hazard.riskLevel}
                        </Badge>
                        {!hazard.active && <Badge variant="outline">Resolved</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {hazard.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Type: {hazard.type}</span>
                        <span>
                          Reported: {new Date(hazard.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {hazard.active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolveHazard(hazard.id)}
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )
          ) : (
            <HazardIdentificationForm />
          )}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={activeIncidentView === 'list' ? 'default' : 'outline'}
                onClick={() => setActiveIncidentView('list')}
                className={activeIncidentView === 'list' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
              >
                All Incidents ({incidents.filter(i => i.status === 'OPEN').length})
              </Button>
              <Button
                variant={activeIncidentView === 'form' ? 'default' : 'outline'}
                onClick={() => setActiveIncidentView('form')}
                className={activeIncidentView === 'form' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
              >
                <Plus className="h-4 w-4 mr-2" />
                Report New Incident
              </Button>
            </div>
          </div>

          {activeIncidentView === 'list' ? (
            incidents.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No incidents reported
              </Card>
            ) : (
              incidents.map(incident => (
                <Card key={incident.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">
                          {incident.type.replace(/_/g, ' ')}
                        </h3>
                        <Badge
                          variant={
                            incident.severity === 'CRITICAL' ? 'destructive' : 'default'
                          }
                        >
                          {incident.severity}
                        </Badge>
                        <Badge
                          variant={incident.status === 'OPEN' ? 'default' : 'outline'}
                        >
                          {incident.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {incident.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Occurred: {new Date(incident.occurredAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {incident.status === 'OPEN' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleUpdateIncidentStatus(incident.id, 'UNDER_INVESTIGATION')
                          }
                        >
                          Investigate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleUpdateIncidentStatus(incident.id, 'CLOSED')
                          }
                        >
                          Close
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )
          ) : (
            <IncidentReportingForm />
          )}
        </TabsContent>

        <TabsContent value="documentation" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">H&S Documentation</h3>
                <div className="flex gap-2">
                  <Button
                    variant={documentationView === 'forms' ? 'default' : 'outline'}
                    onClick={() => setDocumentationView('forms')}
                    className={documentationView === 'forms' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
                  >
                    Forms
                  </Button>
                  <Button
                    variant={documentationView === 'tracker' ? 'default' : 'outline'}
                    onClick={() => setDocumentationView('tracker')}
                    className={documentationView === 'tracker' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
                  >
                    Document Tracker
                  </Button>
                  <Button
                    variant={documentationView === 'list' ? 'default' : 'outline'}
                    onClick={() => setDocumentationView('list')}
                    className={documentationView === 'list' ? 'bg-pulse-forest hover:bg-pulse-forest-dark' : ''}
                  >
                    Document Library
                  </Button>
                </div>
              </div>
            </div>
            
            {documentationView === 'forms' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select document type to create" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="risk_assessment">Risk Assessment</SelectItem>
                      <SelectItem value="contractor_safety">Contractor Safety</SelectItem>
                      <SelectItem value="chemical_register">Chemical Register</SelectItem>
                      <SelectItem value="animal_welfare_plan">Animal Welfare Plan</SelectItem>
                      <SelectItem value="incident_report">Incident Report</SelectItem>
                      <SelectItem value="hazard_register">Hazard Register</SelectItem>
                      <SelectItem value="emergency_procedures">Emergency Procedures</SelectItem>
                      <SelectItem value="training_records">Training Records</SelectItem>
                      <SelectItem value="equipment_inspection">Equipment Inspection</SelectItem>
                      <SelectItem value="visitor_sign_in_register">Visitor Sign-In Register</SelectItem>
                      <SelectItem value="site_induction_checklist">Site Induction Checklist</SelectItem>
                      <SelectItem value="contractor_pre_qualification">Contractor Pre-Qualification</SelectItem>
                      <SelectItem value="emergency_contact_register">Emergency Contact Register</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedDocumentType ? (
                  <DynamicFormGenerator documentType={selectedDocumentType} />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Select a document type to create a new form</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            
            {documentationView === 'tracker' && (
              <ContractorDocumentTracker />
            )}
            
            {documentationView === 'list' && (
              <ComplianceDocsPage />
            )}
          </div>
        </TabsContent>

        <TabsContent value="lone_workers" className="mt-6">
          <LoneWorkerSafety />
        </TabsContent>

        <TabsContent value="registry" className="mt-6">
          <DigitalRegistry />
        </TabsContent>
      </Tabs>
    </div>
  );
}
