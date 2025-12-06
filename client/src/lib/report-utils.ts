// Phase 6B: Advanced Reporting & Exports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TreatmentReportData {
  animalId: string;
  animalTag: string;
  dateTime: string;
  condition: string;
  productName: string;
  dosage: string;
  staffMember: string;
  status: string;
}

export interface PastureReportData {
  name: string;
  acres: number;
  currentAnimals: number;
  grazingDays: number;
  restPeriodDays: number;
  soilQuality: number;
  grassCoverKg: number;
}

export function generateTreatmentPDF(
  treatments: TreatmentReportData[],
  dateRange: { from: string; to: string }
) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Treatment Summary Report', 14, 20);
  
  doc.setFontSize(11);
  doc.text(`Date Range: ${dateRange.from} to ${dateRange.to}`, 14, 28);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);
  
  // Table
  autoTable(doc, {
    startY: 42,
    head: [['Animal', 'Date', 'Condition', 'Product', 'Dosage', 'Staff', 'Status']],
    body: treatments.map(t => [
      t.animalTag,
      new Date(t.dateTime).toLocaleDateString(),
      t.condition || '—',
      t.productName,
      t.dosage,
      t.staffMember,
      t.status,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [67, 97, 238] },
    styles: { fontSize: 9 },
  });
  
  // Footer with page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Download
  doc.save(`treatment-report-${dateRange.from}-to-${dateRange.to}.pdf`);
}

export function generatePasturePDF(pastures: PastureReportData[]) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('Pasture Health Report', 14, 20);
  
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  
  // Summary statistics
  const totalAcres = pastures.reduce((sum, p) => sum + (p.acres || 0), 0);
  const totalAnimals = pastures.reduce((sum, p) => sum + (p.currentAnimals || 0), 0);
  const avgSoilQuality = pastures.length > 0
    ? (pastures.reduce((sum, p) => sum + (p.soilQuality || 0), 0) / pastures.length).toFixed(1)
    : 0;
  
  doc.text(`Total Pastures: ${pastures.length}`, 14, 36);
  doc.text(`Total Acres: ${totalAcres.toFixed(1)}`, 14, 42);
  doc.text(`Total Animals: ${totalAnimals}`, 14, 48);
  doc.text(`Avg Soil Quality: ${avgSoilQuality}/10`, 14, 54);
  
  // Table
  autoTable(doc, {
    startY: 62,
    head: [['Pasture', 'Acres', 'Animals', 'Grazing Days', 'Rest Days', 'Soil Quality', 'Grass Cover (kg/ha)']],
    body: pastures.map(p => [
      p.name,
      p.acres?.toFixed(1) || '—',
      p.currentAnimals || 0,
      p.grazingDays || '—',
      p.restPeriodDays || '—',
      p.soilQuality || '—',
      p.grassCoverKg || '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [34, 197, 94] },
    styles: { fontSize: 9 },
  });
  
  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`pasture-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values with commas, quotes, or newlines
        if (value == null) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    ),
  ].join('\n');
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
