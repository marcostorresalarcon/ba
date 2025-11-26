export type ProjectStatus = 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface ProjectMilestone {
  name: string;
  description?: string;
  dueDate?: string;
  completed?: boolean;
  completedDate?: string;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  companyId: string;
  customerId: string;
  estimatorId: string;
  status: ProjectStatus;
  projectType?: string;
  startDate?: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  budget?: number;
  /** @deprecated Use approvedQuotesByCategory instead */
  approvedQuoteId?: string;
  approvedQuotesByCategory?: {
    kitchen?: string;
    bathroom?: string;
    basement?: string;
    'additional-work'?: string;
  };
  milestones?: ProjectMilestone[];
  photos?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectPayload = Omit<Project, '_id' | 'createdAt' | 'updatedAt'>;

export interface ProjectWithQuoteCount extends Project {
  quoteCount: number;
}

