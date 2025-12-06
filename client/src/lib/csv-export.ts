import type { Animal, AnimalGroup, Pasture } from '@shared/schema';
import { format } from 'date-fns';

// Export-specific type with derived fields
export interface AnimalForExport extends Animal {
  age?: number; // Calculated age in months
  groupNames?: string; // Joined group names
  pastureName?: string; // Current pasture name
}

export interface ExportOptions {
  includeGroups?: boolean;
  includePasture?: boolean;
  includeNotes?: boolean;
  includeTimestamps?: boolean;
}

// Column descriptor for type-safe CSV generation
interface ColumnDescriptor {
  label: string;
  accessor: (animal: AnimalForExport) => string;
}

export function exportAnimalsToCSV(
  animals: AnimalForExport[],
  options: ExportOptions = {}
): string {
  const {
    includeGroups = true,
    includePasture = true,
    includeNotes = false,
    includeTimestamps = false,
  } = options;

  // Build column descriptors
  const columns: ColumnDescriptor[] = [
    { label: 'NAIT Tag', accessor: (a) => a.naitTag || '' },
    { label: 'Cow ID', accessor: (a) => a.cowId || '' },
    { label: 'Breed', accessor: (a) => a.breed || '' },
    { label: 'Sex', accessor: (a) => a.sex || '' },
    { label: 'Date of Birth', accessor: (a) => a.dateOfBirth || '' },
    { label: 'Age (months)', accessor: (a) => a.age?.toString() || '' },
    { label: 'Status', accessor: (a) => a.status || '' },
    { label: 'Herd', accessor: (a) => a.herd || '' },
  ];

  if (includePasture) {
    columns.push({ label: 'Current Pasture', accessor: (a) => a.pastureName || '' });
  }

  if (includeGroups) {
    columns.push({ label: 'Groups', accessor: (a) => a.groupNames || '' });
  }

  if (includeNotes) {
    columns.push({ label: 'Notes', accessor: (a) => a.notes || '' });
  }

  if (includeTimestamps) {
    columns.push(
      { label: 'Created At', accessor: (a) => a.createdAt ? format(new Date(a.createdAt), 'yyyy-MM-dd HH:mm:ss') : '' },
      { label: 'Updated At', accessor: (a) => a.updatedAt ? format(new Date(a.updatedAt), 'yyyy-MM-dd HH:mm:ss') : '' }
    );
  }

  // Generate headers
  const headers = columns.map(c => c.label);

  // Generate rows
  const rows = animals.map(animal => 
    columns.map(col => escapeCSVValue(col.accessor(animal)))
  );

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csvContent;
}

function escapeCSVValue(value: string): string {
  // Escape double quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function calculateAge(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 0;
  const birth = new Date(dateOfBirth);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return months;
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function generateFilename(prefix: string = 'animals', count: number = 0): string {
  const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
  return `${prefix}-${count}-${timestamp}.csv`;
}

// Helper to prepare animals for export with derived fields
export function prepareAnimalsForExport(
  animals: Animal[],
  groups: AnimalGroup[],
  pastures: Pasture[],
  memberships: { groupId: string; animalId: string }[]
): AnimalForExport[] {
  return animals.map(animal => {
    // Calculate age
    const age = calculateAge(animal.dateOfBirth);

    // Get group names
    const animalGroupIds = memberships
      .filter(m => m.animalId === animal.id)
      .map(m => m.groupId);
    const animalGroups = groups.filter(g => animalGroupIds.includes(g.id));
    const groupNames = animalGroups.map(g => g.name).join('; ');

    // Get pasture name
    const pasture = pastures.find(p => p.id === animal.currentPastureId);
    const pastureName = pasture?.name || '';

    return {
      ...animal,
      age,
      groupNames,
      pastureName,
    };
  });
}
