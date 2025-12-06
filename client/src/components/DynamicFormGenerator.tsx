import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save, Send, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'number' | 'email' | 'phone';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  description?: string;
}

interface FormSchema {
  id: string;
  title: string;
  description: string;
  category: string;
  fields: FormField[];
  submitText: string;
  saveText: string;
}

const formSchemas: Record<string, FormSchema> = {
  risk_assessment: {
    id: 'risk_assessment',
    title: 'Risk Assessment Form',
    description: 'Complete workplace risk assessment following WorkSafe NZ guidelines',
    category: 'Health & Safety',
    submitText: 'Submit Risk Assessment',
    saveText: 'Save as Draft',
    fields: [
      {
        id: 'hazard_title',
        type: 'text',
        label: 'Hazard Title',
        required: true,
        placeholder: 'Brief description of the hazard'
      },
      {
        id: 'location',
        type: 'text',
        label: 'Location',
        required: true,
        placeholder: 'Where is the hazard located?'
      },
      {
        id: 'hazard_type',
        type: 'select',
        label: 'Hazard Type',
        required: true,
        options: ['Physical', 'Chemical', 'Biological', 'Ergonomic', 'Psychosocial', 'Environmental']
      },
      {
        id: 'description',
        type: 'textarea',
        label: 'Hazard Description',
        required: true,
        placeholder: 'Detailed description of the hazard and potential harm'
      },
      {
        id: 'likelihood',
        type: 'select',
        label: 'Likelihood',
        required: true,
        options: ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare']
      },
      {
        id: 'consequence',
        type: 'select',
        label: 'Consequence',
        required: true,
        options: ['Catastrophic', 'Critical', 'Moderate', 'Minor', 'Insignificant']
      },
      {
        id: 'people_at_risk',
        type: 'checkbox',
        label: 'People at Risk',
        required: true,
        options: ['Employees', 'Contractors', 'Visitors', 'Public', 'Animals']
      },
      {
        id: 'existing_controls',
        type: 'textarea',
        label: 'Existing Controls',
        required: false,
        placeholder: 'What controls are already in place?'
      },
      {
        id: 'required_controls',
        type: 'textarea',
        label: 'Additional Controls Required',
        required: true,
        placeholder: 'What additional controls are needed?'
      },
      {
        id: 'responsible_person',
        type: 'text',
        label: 'Responsible Person',
        required: true,
        placeholder: 'Who is responsible for implementing controls?'
      },
      {
        id: 'target_date',
        type: 'date',
        label: 'Target Completion Date',
        required: true
      }
    ]
  },
  
  contractor_safety: {
    id: 'contractor_safety',
    title: 'Contractor Safety Management',
    description: 'Contractor induction, safety procedures, and compliance verification',
    category: 'Contractor Management',
    submitText: 'Submit Contractor Safety',
    saveText: 'Save as Draft',
    fields: [
      {
        id: 'company_name',
        type: 'text',
        label: 'Company Name',
        required: true,
        placeholder: 'Contractor company name'
      },
      {
        id: 'contact_person',
        type: 'text',
        label: 'Contact Person',
        required: true,
        placeholder: 'Primary contact name'
      },
      {
        id: 'phone',
        type: 'phone',
        label: 'Phone Number',
        required: true,
        placeholder: '+64 21 123 4567'
      },
      {
        id: 'email',
        type: 'email',
        label: 'Email Address',
        required: true,
        placeholder: 'email@company.com'
      },
      {
        id: 'work_type',
        type: 'select',
        label: 'Type of Work',
        required: true,
        options: ['Electrical', 'Plumbing', 'Construction', 'Maintenance', 'Consulting', 'Other']
      },
      {
        id: 'insurance_certificate',
        type: 'text',
        label: 'Insurance Certificate Number',
        required: true,
        placeholder: 'Certificate of Currency number'
      },
      {
        id: 'insurance_expiry',
        type: 'date',
        label: 'Insurance Expiry Date',
        required: true
      },
      {
        id: 'health_safety_policy',
        type: 'checkbox',
        label: 'Health & Safety Documentation',
        required: true,
        options: ['Health & Safety Policy', 'Site Safety Plan', 'Method Statements', 'Risk Assessments']
      },
      {
        id: 'induction_completed',
        type: 'radio',
        label: 'Site Induction Status',
        required: true,
        options: ['Completed', 'Scheduled', 'Not Required']
      },
      {
        id: 'access_areas',
        type: 'checkbox',
        label: 'Authorized Access Areas',
        required: true,
        options: ['General Areas', 'Workshop', 'Animal Housing', 'Chemical Storage', 'Restricted Areas']
      },
      {
        id: 'special_requirements',
        type: 'textarea',
        label: 'Special Requirements or Conditions',
        required: false,
        placeholder: 'Any special safety requirements or conditions'
      }
    ]
  },

  chemical_register: {
    id: 'chemical_register',
    title: 'Chemical Register',
    description: 'Farm chemical inventory and safety documentation',
    category: 'Chemical Management',
    submitText: 'Submit Chemical Register',
    saveText: 'Save as Draft',
    fields: [
      {
        id: 'chemical_name',
        type: 'text',
        label: 'Chemical Name',
        required: true,
        placeholder: 'Product name'
      },
      {
        id: 'supplier',
        type: 'text',
        label: 'Supplier',
        required: true,
        placeholder: 'Manufacturer or supplier'
      },
      {
        id: 'product_code',
        type: 'text',
        label: 'Product Code',
        required: false,
        placeholder: 'Product identification code'
      },
      {
        id: 'hazard_class',
        type: 'select',
        label: 'Hazard Classification',
        required: true,
        options: ['Class 1 - Explosives', 'Class 2 _ Gases', 'Class 3 _ Flammable Liquids', 'Class 4 _ Flammable Solids', 'Class 5 _ Oxidizing', 'Class 6 _ Toxic', 'Class 7 _ Radioactive', 'Class 8 _ Corrosive', 'Class 9 _ Miscellaneous']
      },
      {
        id: 'storage_location',
        type: 'text',
        label: 'Storage Location',
        required: true,
        placeholder: 'Where is it stored?'
      },
      {
        id: 'quantity',
        type: 'number',
        label: 'Quantity on Hand',
        required: true,
        placeholder: 'Amount in stock'
      },
      {
        id: 'unit',
        type: 'select',
        label: 'Unit of Measure',
        required: true,
        options: ['Liters', 'Kilograms', 'Containers', 'Other']
      },
      {
        id: 'sds_available',
        type: 'radio',
        label: 'Safety Data Sheet Available',
        required: true,
        options: ['Yes', 'No', 'Digital Only']
      },
      {
        id: 'expiry_date',
        type: 'date',
        label: 'Expiry Date',
        required: false
      },
      {
        id: 'usage_purpose',
        type: 'textarea',
        label: 'Purpose of Use',
        required: true,
        placeholder: 'How and where is this chemical used?'
      },
      {
        id: 'ppe_required',
        type: 'checkbox',
        label: 'Required PPE',
        required: true,
        options: ['Gloves', 'Goggles', 'Respirator', 'Protective Clothing', 'Boots']
      }
    ]
  },

  emergency_procedures: {
    id: 'emergency_procedures',
    title: 'Emergency Procedures',
    description: 'Farm emergency response procedures and evacuation plans',
    category: 'Emergency Management',
    submitText: 'Submit Emergency Procedures',
    saveText: 'Save as Draft',
    fields: [
      {
        id: 'procedure_title',
        type: 'text',
        label: 'Procedure Title',
        required: true,
        placeholder: 'e.g., Fire Emergency, Chemical Spill, Animal Escape'
      },
      {
        id: 'emergency_type',
        type: 'select',
        label: 'Emergency Type',
        required: true,
        options: ['Fire', 'Chemical Spill', 'Medical Emergency', 'Animal Escape', 'Natural Disaster', 'Equipment Failure', 'Security Threat']
      },
      {
        id: 'response_steps',
        type: 'textarea',
        label: 'Immediate Response Steps',
        required: true,
        placeholder: 'Step-by-step actions to take immediately'
      },
      {
        id: 'evacuation_routes',
        type: 'textarea',
        label: 'Evacuation Routes & Assembly Points',
        required: true,
        placeholder: 'Primary and secondary evacuation routes with assembly point locations'
      },
      {
        id: 'emergency_contacts',
        type: 'textarea',
        label: 'Emergency Contacts',
        required: true,
        placeholder: 'Internal and external emergency contact numbers'
      },
      {
        id: 'equipment_required',
        type: 'checkbox',
        label: 'Emergency Equipment Required',
        required: true,
        options: ['Fire Extinguishers', 'First Aid Kits', 'Spill Kits', 'Emergency Communication', 'Safety Equipment']
      }
    ]
  },

  training_records: {
    id: 'training_records',
    title: 'Training Records',
    description: 'Employee training documentation and competency records',
    category: 'Training Management',
    submitText: 'Submit Training Record',
    saveText: 'Save as Draft',
    fields: [
      {
        id: 'employee_name',
        type: 'text',
        label: 'Employee Name',
        required: true,
        placeholder: 'Full name of employee'
      },
      {
        id: 'training_type',
        type: 'select',
        label: 'Training Type',
        required: true,
        options: ['Health & Safety Induction', 'Equipment Operation', 'Chemical Handling', 'Emergency Response', 'Animal Handling', 'Vehicle Operation', 'First Aid']
      },
      {
        id: 'training_date',
        type: 'date',
        label: 'Training Date',
        required: true
      },
      {
        id: 'trainer_name',
        type: 'text',
        label: 'Trainer/Assessor Name',
        required: true,
        placeholder: 'Name of trainer or assessing person'
      },
      {
        id: 'training_duration',
        type: 'text',
        label: 'Training Duration',
        required: true,
        placeholder: 'e.g., 2 hours, 1 day, 3 days'
      },
      {
        id: 'competency_level',
        type: 'select',
        label: 'Competency Level Achieved',
        required: true,
        options: ['Basic Awareness', 'Competent', 'Proficient', 'Expert']
      },
      {
        id: 'refresher_required',
        type: 'date',
        label: 'Refresher Training Required',
        required: true
      },
      {
        id: 'training_notes',
        type: 'textarea',
        label: 'Training Notes & Observations',
        required: false,
        placeholder: 'Additional comments about training performance'
      }
    ]
  },

  equipment_inspection: {
    id: 'equipment_inspection',
    title: 'Equipment Inspection Record',
    description: 'Regular equipment inspection and maintenance documentation',
    category: 'Equipment Management',
    submitText: 'Submit Inspection Record',
    saveText: 'Save as Draft',
    fields: [
      {
        id: 'equipment_name',
        type: 'text',
        label: 'Equipment Name/ID',
        required: true,
        placeholder: 'Equipment identification'
      },
      {
        id: 'equipment_type',
        type: 'select',
        label: 'Equipment Type',
        required: true,
        options: ['Vehicle', 'Machinery', 'Electrical Equipment', 'Safety Equipment', 'Tools', 'Handling Equipment', 'Other']
      },
      {
        id: 'inspection_date',
        type: 'date',
        label: 'Inspection Date',
        required: true
      },
      {
        id: 'inspector_name',
        type: 'text',
        label: 'Inspector Name',
        required: true,
        placeholder: 'Name of person conducting inspection'
      },
      {
        id: 'inspection_type',
        type: 'select',
        label: 'Inspection Type',
        required: true,
        options: ['Daily Check', 'Weekly Inspection', 'Monthly Service', 'Annual Inspection', 'Pre-Use Check']
      },
      {
        id: 'condition_status',
        type: 'radio',
        label: 'Overall Condition',
        required: true,
        options: ['Excellent', 'Good', 'Fair', 'Poor - Requires Attention', 'Unsafe - Do Not Use']
      },
      {
        id: 'defects_found',
        type: 'textarea',
        label: 'Defects or Issues Found',
        required: false,
        placeholder: 'Describe any defects or maintenance issues'
      },
      {
        id: 'action_required',
        type: 'textarea',
        label: 'Action Required',
        required: false,
        placeholder: 'Maintenance or repair actions needed'
      },
      {
        id: 'next_inspection',
        type: 'date',
        label: 'Next Inspection Due',
        required: true
      }
    ]
  },

  visitor_sign_in_register: {
    id: 'visitor_sign_in_register',
    title: 'Visitor Sign-In Register',
    description: 'Daily visitor sign-in and sign-out register',
    category: 'Visitor Management',
    submitText: 'Submit Sign-In Record',
    saveText: 'Save as Draft',
    fields: [
      {
        id: 'visitor_name',
        type: 'text',
        label: 'Visitor Name',
        required: true,
        placeholder: 'Full name of visitor'
      },
      {
        id: 'company_organization',
        type: 'text',
        label: 'Company/Organization',
        required: false,
        placeholder: 'Visitor company or organization'
      },
      {
        id: 'phone_number',
        type: 'phone',
        label: 'Phone Number',
        required: true,
        placeholder: '+64 21 123 4567'
      },
      {
        id: 'visit_purpose',
        type: 'text',
        label: 'Purpose of Visit',
        required: true,
        placeholder: 'Reason for visiting'
      },
      {
        id: 'host_employee',
        type: 'text',
        label: 'Host Employee',
        required: true,
        placeholder: 'Employee they are visiting'
      },
      {
        id: 'sign_in_time',
        type: 'date',
        label: 'Sign-In Time',
        required: true
      },
      {
        id: 'sign_out_time',
        type: 'date',
        label: 'Sign-Out Time',
        required: false
      },
      {
        id: 'vehicle_registration',
        type: 'text',
        label: 'Vehicle Registration',
        required: false,
        placeholder: 'Vehicle registration if applicable'
      },
      {
        id: 'safety_briefing',
        type: 'checkbox',
        label: 'Safety Briefing Completed',
        required: true,
        options: ['Site Safety Rules', 'Emergency Procedures', 'Hazard Awareness', 'PPE Requirements']
      },
      {
        id: 'emergency_contact',
        type: 'text',
        label: 'Emergency Contact',
        required: true,
        placeholder: 'Emergency contact name and phone'
      }
    ]
  },

  site_induction_checklist: {
    id: 'site_induction_checklist',
    title: 'Site Induction Checklist',
    description: 'Comprehensive site induction for new personnel and contractors',
    category: 'Safety Management',
    submitText: 'Submit Induction Checklist',
    saveText: 'Save as Draft',
    fields: [
      {
        id: 'inductee_name',
        type: 'text',
        label: 'Inductee Name',
        required: true,
        placeholder: 'Full name of person being inducted'
      },
      {
        id: 'inductee_type',
        type: 'select',
        label: 'Inductee Type',
        required: true,
        options: ['New Employee', 'Contractor', 'Visitor', 'Temporary Worker', 'Trainee']
      },
      {
        id: 'induction_date',
        type: 'date',
        label: 'Induction Date',
        required: true
      },
      {
        id: 'inductor_name',
        type: 'text',
        label: 'Inductor Name',
        required: true,
        placeholder: 'Name of person conducting induction'
      },
      {
        id: 'safety_topics_covered',
        type: 'checkbox',
        label: 'Safety Topics Covered',
        required: true,
        options: [
          'Health & Safety Policy',
          'Emergency Procedures',
          'First Aid Locations',
          'Hazard Identification',
          'PPE Requirements',
          'Site Rules',
          'Incident Reporting',
          'Chemical Safety',
          'Equipment Safety',
          'Biosecurity Procedures'
        ]
      },
      {
        id: 'site_areas_shown',
        type: 'checkbox',
        label: 'Site Areas Shown',
        required: true,
        options: [
          'Emergency Exits',
          'Assembly Points',
          'First Aid Stations',
          'Fire Extinguishers',
          'Hazard Areas',
          'Restricted Areas',
          'Facilities',
          'Work Areas'
        ]
      },
      {
        id: 'competency_assessment',
        type: 'radio',
        label: 'Competency Assessment',
        required: true,
        options: ['Fully Competent', 'Requires Supervision', 'Needs Additional Training', 'Not Competent - Requires Re-induction']
      },
      {
        id: 'induction_notes',
        type: 'textarea',
        label: 'Additional Notes',
        required: false,
        placeholder: 'Any additional observations or requirements'
      }
    ]
  }
};

export default function DynamicFormGenerator({ documentType }: { documentType: string }) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const schema = formSchemas[documentType];
  
  if (!schema) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Form schema not found for document type: {documentType}</p>
        </CardContent>
      </Card>
    );
  }

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear error when field is updated
    if (errors[fieldId]) {
      setErrors(prev => ({ ...prev, [fieldId]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    schema.fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.label} is required`;
      }
      
      // Additional validation based on field type
      if (field.type === 'email' && formData[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.id])) {
          newErrors[field.id] = 'Please enter a valid email address';
        }
      }
      
      if (field.type === 'phone' && formData[field.id]) {
        const phoneRegex = /^[\d\s\+\-\(\)]+$/;
        if (!phoneRegex.test(formData[field.id])) {
          newErrors[field.id] = 'Please enter a valid phone number';
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (action: 'save' | 'submit') => {
    if (!validateForm()) {
      return;
    }
    
    console.log('Form submitted:', { documentType, formData, action });
    
    if (action === 'submit') {
      alert(`${schema.title} submitted successfully!`);
    } else {
      alert(`${schema.title} saved as draft!`);
    }
  };

  const exportForm = () => {
    const exportData = {
      formTitle: schema.title,
      documentType: schema.id,
      category: schema.category,
      submittedAt: new Date().toISOString(),
      data: formData
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema.id.replace(/_/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';
    const error = errors[field.id];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(val) => handleFieldChange(field.id, val)}>
              <SelectTrigger className={error ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.placeholder || 'Select an option'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}_${option}`}
                    checked={Array.isArray(value) ? value.includes(option) : false}
                    onCheckedChange={(checked) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      const newValues = checked 
                        ? [...currentValues, option]
                        : currentValues.filter(v => v !== option);
                      handleFieldChange(field.id, newValues);
                    }}
                  />
                  <Label htmlFor={`${field.id}_${option}`} className="text-sm">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup value={value} onValueChange={(val) => handleFieldChange(field.id, val)}>
              {field.options?.map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}_${option}`} />
                  <Label htmlFor={`${field.id}_${option}`} className="text-sm">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${error ? 'border-red-500' : ''}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value ? format(new Date(value), 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={value ? new Date(value) : undefined}
                  onSelect={(date) => handleFieldChange(field.id, date?.toISOString())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-pulse-forest" />
              {schema.title}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">{schema.description}</p>
            <Badge variant="outline" className="mt-2">
              {schema.category}
            </Badge>
          </div>
          <Button variant="outline" onClick={exportForm}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {schema.fields.map(renderField)}
        
        <div className="flex gap-4 pt-4 border-t">
          <Button 
            onClick={() => handleSubmit('save')} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {schema.saveText}
          </Button>
          <Button 
            onClick={() => handleSubmit('submit')} 
            className="bg-pulse-forest hover:bg-pulse-forest-dark text-white flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {schema.submitText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
