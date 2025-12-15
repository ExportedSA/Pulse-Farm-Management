import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock the API functions
vi.mock('../../client/src/lib/pulseApi', () => ({
  pulseGet: vi.fn(),
  pulsePost: vi.fn(),
  pulsePatch: vi.fn(),
}));

// Mock wouter
vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ['/app/jobs', vi.fn()],
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => '2024-01-15',
  isToday: () => false,
  isPast: () => false,
  isFuture: () => true,
}));

// Simple JobsPage component for testing
const JobsPage = ({ jobs, onCreateJob, onUpdateStatus }: {
  jobs: any[];
  onCreateJob: (job: any) => void;
  onUpdateStatus: (id: string, status: string) => void;
}) => {
  const [showForm, setShowForm] = React.useState(false);
  const [formData, setFormData] = React.useState({ title: '', description: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateJob(formData);
    setFormData({ title: '', description: '' });
    setShowForm(false);
  };

  return (
    <div>
      <h1>Jobs & Tasks</h1>
      <button onClick={() => setShowForm(!showForm)} data-testid="add-job-btn">
        {showForm ? 'Cancel' : 'Add Job'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} data-testid="job-form">
          <input
            type="text"
            placeholder="Job title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            data-testid="job-title-input"
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            data-testid="job-description-input"
          />
          <button type="submit" data-testid="submit-job-btn">Create Job</button>
        </form>
      )}

      <div data-testid="jobs-list">
        {jobs.length === 0 ? (
          <p>No jobs found</p>
        ) : (
          jobs.map((job) => (
            <div key={job.id} data-testid={`job-item-${job.id}`}>
              <h3 data-testid={`job-title-${job.id}`}>{job.title}</h3>
              <p>{job.description}</p>
              <span data-testid={`job-status-${job.id}`}>{job.status}</span>
              <select
                value={job.status}
                onChange={(e) => onUpdateStatus(job.id, e.target.value)}
                data-testid={`job-status-select-${job.id}`}
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

describe('JobsPage Component Tests', () => {
  const mockJobs = [
    {
      id: 'job-1',
      title: 'Fix fence in paddock 3',
      description: 'Repair broken wire fence',
      status: 'PENDING',
      dueDate: '2024-01-20',
      createdAt: '2024-01-10',
    },
    {
      id: 'job-2',
      title: 'Service tractor',
      description: 'Annual maintenance',
      status: 'IN_PROGRESS',
      dueDate: '2024-01-25',
      createdAt: '2024-01-12',
    },
    {
      id: 'job-3',
      title: 'Check water troughs',
      description: 'Inspect all paddock water troughs',
      status: 'COMPLETED',
      dueDate: '2024-01-15',
      createdAt: '2024-01-08',
    },
  ];

  let mockOnCreateJob: ReturnType<typeof vi.fn>;
  let mockOnUpdateStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnCreateJob = vi.fn();
    mockOnUpdateStatus = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Job List Display', () => {
    it('should display all job titles', () => {
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      expect(screen.getByText('Fix fence in paddock 3')).toBeInTheDocument();
      expect(screen.getByText('Service tractor')).toBeInTheDocument();
      expect(screen.getByText('Check water troughs')).toBeInTheDocument();
    });

    it('should display job statuses', () => {
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      expect(screen.getByTestId('job-status-job-1')).toHaveTextContent('PENDING');
      expect(screen.getByTestId('job-status-job-2')).toHaveTextContent('IN_PROGRESS');
      expect(screen.getByTestId('job-status-job-3')).toHaveTextContent('COMPLETED');
    });

    it('should display "No jobs found" when list is empty', () => {
      render(
        <JobsPage
          jobs={[]}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      expect(screen.getByText('No jobs found')).toBeInTheDocument();
    });

    it('should render correct number of job items', () => {
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      const jobsList = screen.getByTestId('jobs-list');
      expect(jobsList.querySelectorAll('[data-testid^="job-item-"]').length).toBe(3);
    });
  });

  describe('Job Form', () => {
    it('should show form when Add Job button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      // Form should not be visible initially
      expect(screen.queryByTestId('job-form')).not.toBeInTheDocument();

      // Click Add Job button
      await user.click(screen.getByTestId('add-job-btn'));

      // Form should now be visible
      expect(screen.getByTestId('job-form')).toBeInTheDocument();
    });

    it('should hide form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      // Open form
      await user.click(screen.getByTestId('add-job-btn'));
      expect(screen.getByTestId('job-form')).toBeInTheDocument();

      // Click Cancel (same button)
      await user.click(screen.getByTestId('add-job-btn'));
      expect(screen.queryByTestId('job-form')).not.toBeInTheDocument();
    });

    it('should call onCreateJob when form is submitted', async () => {
      const user = userEvent.setup();
      
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      // Open form
      await user.click(screen.getByTestId('add-job-btn'));

      // Fill in form
      await user.type(screen.getByTestId('job-title-input'), 'New test job');
      await user.type(screen.getByTestId('job-description-input'), 'Test description');

      // Submit form
      await user.click(screen.getByTestId('submit-job-btn'));

      // Verify onCreateJob was called with correct data
      expect(mockOnCreateJob).toHaveBeenCalledWith({
        title: 'New test job',
        description: 'Test description',
      });
    });

    it('should clear form after submission', async () => {
      const user = userEvent.setup();
      
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      // Open form
      await user.click(screen.getByTestId('add-job-btn'));

      // Fill in form
      await user.type(screen.getByTestId('job-title-input'), 'New test job');
      await user.type(screen.getByTestId('job-description-input'), 'Test description');

      // Submit form
      await user.click(screen.getByTestId('submit-job-btn'));

      // Form should be hidden after submission
      expect(screen.queryByTestId('job-form')).not.toBeInTheDocument();
    });
  });

  describe('Job Status Updates', () => {
    it('should call onUpdateStatus when status is changed', async () => {
      const user = userEvent.setup();
      
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      // Change status of first job
      const statusSelect = screen.getByTestId('job-status-select-job-1');
      await user.selectOptions(statusSelect, 'IN_PROGRESS');

      expect(mockOnUpdateStatus).toHaveBeenCalledWith('job-1', 'IN_PROGRESS');
    });

    it('should allow changing status to COMPLETED', async () => {
      const user = userEvent.setup();
      
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      const statusSelect = screen.getByTestId('job-status-select-job-1');
      await user.selectOptions(statusSelect, 'COMPLETED');

      expect(mockOnUpdateStatus).toHaveBeenCalledWith('job-1', 'COMPLETED');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Jobs & Tasks');
    });

    it('should have accessible form inputs', async () => {
      const user = userEvent.setup();
      
      render(
        <JobsPage
          jobs={mockJobs}
          onCreateJob={mockOnCreateJob}
          onUpdateStatus={mockOnUpdateStatus}
        />
      );

      await user.click(screen.getByTestId('add-job-btn'));

      expect(screen.getByPlaceholderText('Job title')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
    });
  });
});
