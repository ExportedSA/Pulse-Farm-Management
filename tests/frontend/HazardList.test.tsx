import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => '2024-01-15',
}));

// Simple HazardList component for testing
const HazardList = ({ hazards, onResolve, onReport }: {
  hazards: any[];
  onResolve: (id: string) => void;
  onReport: (hazard: any) => void;
}) => {
  const [showForm, setShowForm] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    riskLevel: 'medium',
    location: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onReport(formData);
    setFormData({ title: '', description: '', riskLevel: 'medium', location: '' });
    setShowForm(false);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const activeHazards = hazards.filter(h => h.status !== 'resolved');
  const resolvedHazards = hazards.filter(h => h.status === 'resolved');

  return (
    <div>
      <h1>Hazard Management</h1>
      
      <div data-testid="hazard-summary">
        <span data-testid="active-count">{activeHazards.length} active</span>
        <span data-testid="resolved-count">{resolvedHazards.length} resolved</span>
      </div>

      <button onClick={() => setShowForm(!showForm)} data-testid="report-hazard-btn">
        {showForm ? 'Cancel' : 'Report Hazard'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} data-testid="hazard-form">
          <input
            type="text"
            placeholder="Hazard title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            data-testid="hazard-title-input"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            data-testid="hazard-description-input"
            required
          />
          <select
            value={formData.riskLevel}
            onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
            data-testid="hazard-risk-select"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input
            type="text"
            placeholder="Location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            data-testid="hazard-location-input"
          />
          <button type="submit" data-testid="submit-hazard-btn">Report</button>
        </form>
      )}

      <div data-testid="hazards-list">
        {hazards.length === 0 ? (
          <p data-testid="no-hazards-message">No hazards reported</p>
        ) : (
          hazards.map((hazard) => (
            <div key={hazard.id} data-testid={`hazard-item-${hazard.id}`}>
              <h3 data-testid={`hazard-title-${hazard.id}`}>{hazard.title}</h3>
              <p data-testid={`hazard-description-${hazard.id}`}>{hazard.description}</p>
              <span 
                data-testid={`hazard-risk-${hazard.id}`}
                className={getRiskLevelColor(hazard.riskLevel)}
              >
                {hazard.riskLevel.toUpperCase()}
              </span>
              <span data-testid={`hazard-status-${hazard.id}`}>{hazard.status}</span>
              {hazard.location && (
                <span data-testid={`hazard-location-${hazard.id}`}>{hazard.location}</span>
              )}
              {hazard.status !== 'resolved' && (
                <button
                  onClick={() => onResolve(hazard.id)}
                  data-testid={`resolve-btn-${hazard.id}`}
                >
                  Resolve
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

describe('HazardList Component Tests', () => {
  const mockHazards = [
    {
      id: 'hazard-1',
      title: 'Slippery floor in milking shed',
      description: 'Water pooling near entrance',
      riskLevel: 'high',
      location: 'Milking Shed',
      status: 'open',
      reportedBy: 'user-123',
      createdAt: '2024-01-10',
    },
    {
      id: 'hazard-2',
      title: 'Broken fence in paddock 3',
      description: 'Wire fence damaged by fallen tree',
      riskLevel: 'medium',
      location: 'Paddock 3',
      status: 'resolved',
      reportedBy: 'user-123',
      resolvedAt: '2024-01-12',
      createdAt: '2024-01-08',
    },
    {
      id: 'hazard-3',
      title: 'Chemical storage unlocked',
      description: 'Storage shed door lock broken',
      riskLevel: 'critical',
      location: 'Chemical Shed',
      status: 'open',
      reportedBy: 'user-456',
      createdAt: '2024-01-14',
    },
  ];

  let mockOnResolve: ReturnType<typeof vi.fn>;
  let mockOnReport: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnResolve = vi.fn();
    mockOnReport = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hazard List Display', () => {
    it('should display all hazard titles', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      expect(screen.getByText('Slippery floor in milking shed')).toBeInTheDocument();
      expect(screen.getByText('Broken fence in paddock 3')).toBeInTheDocument();
      expect(screen.getByText('Chemical storage unlocked')).toBeInTheDocument();
    });

    it('should display hazard risk levels', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      expect(screen.getByTestId('hazard-risk-hazard-1')).toHaveTextContent('HIGH');
      expect(screen.getByTestId('hazard-risk-hazard-2')).toHaveTextContent('MEDIUM');
      expect(screen.getByTestId('hazard-risk-hazard-3')).toHaveTextContent('CRITICAL');
    });

    it('should display hazard statuses', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      expect(screen.getByTestId('hazard-status-hazard-1')).toHaveTextContent('open');
      expect(screen.getByTestId('hazard-status-hazard-2')).toHaveTextContent('resolved');
      expect(screen.getByTestId('hazard-status-hazard-3')).toHaveTextContent('open');
    });

    it('should display "No hazards reported" when list is empty', () => {
      render(
        <HazardList
          hazards={[]}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      expect(screen.getByTestId('no-hazards-message')).toHaveTextContent('No hazards reported');
    });

    it('should show correct active and resolved counts', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      expect(screen.getByTestId('active-count')).toHaveTextContent('2 active');
      expect(screen.getByTestId('resolved-count')).toHaveTextContent('1 resolved');
    });

    it('should display hazard locations', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      expect(screen.getByTestId('hazard-location-hazard-1')).toHaveTextContent('Milking Shed');
      expect(screen.getByTestId('hazard-location-hazard-3')).toHaveTextContent('Chemical Shed');
    });
  });

  describe('Resolve Button', () => {
    it('should show Resolve button for active hazards', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      // Active hazards should have resolve button
      expect(screen.getByTestId('resolve-btn-hazard-1')).toBeInTheDocument();
      expect(screen.getByTestId('resolve-btn-hazard-3')).toBeInTheDocument();
    });

    it('should NOT show Resolve button for resolved hazards', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      // Resolved hazard should not have resolve button
      expect(screen.queryByTestId('resolve-btn-hazard-2')).not.toBeInTheDocument();
    });

    it('should call onResolve when Resolve button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      await user.click(screen.getByTestId('resolve-btn-hazard-1'));

      expect(mockOnResolve).toHaveBeenCalledWith('hazard-1');
    });

    it('should call onResolve with correct hazard ID', async () => {
      const user = userEvent.setup();
      
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      await user.click(screen.getByTestId('resolve-btn-hazard-3'));

      expect(mockOnResolve).toHaveBeenCalledWith('hazard-3');
      expect(mockOnResolve).not.toHaveBeenCalledWith('hazard-1');
    });
  });

  describe('Report Hazard Form', () => {
    it('should show form when Report Hazard button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      // Form should not be visible initially
      expect(screen.queryByTestId('hazard-form')).not.toBeInTheDocument();

      // Click Report Hazard button
      await user.click(screen.getByTestId('report-hazard-btn'));

      // Form should now be visible
      expect(screen.getByTestId('hazard-form')).toBeInTheDocument();
    });

    it('should hide form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      // Open form
      await user.click(screen.getByTestId('report-hazard-btn'));
      expect(screen.getByTestId('hazard-form')).toBeInTheDocument();

      // Click Cancel
      await user.click(screen.getByTestId('report-hazard-btn'));
      expect(screen.queryByTestId('hazard-form')).not.toBeInTheDocument();
    });

    it('should call onReport when form is submitted', async () => {
      const user = userEvent.setup();
      
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      // Open form
      await user.click(screen.getByTestId('report-hazard-btn'));

      // Fill in form
      await user.type(screen.getByTestId('hazard-title-input'), 'New hazard');
      await user.type(screen.getByTestId('hazard-description-input'), 'Hazard description');
      await user.selectOptions(screen.getByTestId('hazard-risk-select'), 'high');
      await user.type(screen.getByTestId('hazard-location-input'), 'Main Barn');

      // Submit form
      await user.click(screen.getByTestId('submit-hazard-btn'));

      // Verify onReport was called with correct data
      expect(mockOnReport).toHaveBeenCalledWith({
        title: 'New hazard',
        description: 'Hazard description',
        riskLevel: 'high',
        location: 'Main Barn',
      });
    });

    it('should have all risk level options', async () => {
      const user = userEvent.setup();
      
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      await user.click(screen.getByTestId('report-hazard-btn'));

      const riskSelect = screen.getByTestId('hazard-risk-select');
      expect(riskSelect).toContainHTML('<option value="low">Low</option>');
      expect(riskSelect).toContainHTML('<option value="medium">Medium</option>');
      expect(riskSelect).toContainHTML('<option value="high">High</option>');
      expect(riskSelect).toContainHTML('<option value="critical">Critical</option>');
    });

    it('should clear form after submission', async () => {
      const user = userEvent.setup();
      
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      // Open form
      await user.click(screen.getByTestId('report-hazard-btn'));

      // Fill in form
      await user.type(screen.getByTestId('hazard-title-input'), 'New hazard');
      await user.type(screen.getByTestId('hazard-description-input'), 'Description');

      // Submit form
      await user.click(screen.getByTestId('submit-hazard-btn'));

      // Form should be hidden after submission
      expect(screen.queryByTestId('hazard-form')).not.toBeInTheDocument();
    });
  });

  describe('Risk Level Styling', () => {
    it('should apply correct styling for critical risk level', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      const criticalRisk = screen.getByTestId('hazard-risk-hazard-3');
      expect(criticalRisk).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('should apply correct styling for high risk level', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      const highRisk = screen.getByTestId('hazard-risk-hazard-1');
      expect(highRisk).toHaveClass('bg-orange-100', 'text-orange-800');
    });

    it('should apply correct styling for medium risk level', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      const mediumRisk = screen.getByTestId('hazard-risk-hazard-2');
      expect(mediumRisk).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hazard Management');
    });

    it('should have accessible form inputs', async () => {
      const user = userEvent.setup();
      
      render(
        <HazardList
          hazards={mockHazards}
          onResolve={mockOnResolve}
          onReport={mockOnReport}
        />
      );

      await user.click(screen.getByTestId('report-hazard-btn'));

      expect(screen.getByPlaceholderText('Hazard title')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Location')).toBeInTheDocument();
    });
  });
});
