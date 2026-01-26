export interface KpiResponse {
  quotes: {
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    approved: number;
    conversionRate: number;
  };
  projects: {
    total: number;
    byStatus: Record<string, number>;
  };
  payments: {
    total: number;
    byStatus: Record<string, number> | null;
    totalRevenue: number;
  };
}

export interface InvoiceKpiResponse {
  total: number;
  byStatus: Record<string, number>;
  financials: {
    billed: number;
    paid: number;
    pending: number;
  };
}

export interface SalesDashboardResponse {
  revenue: number;
  pipeline: Record<string, number>;
  conversionRate: number;
  averageTicket: number;
  timesPerStage: {
    quote: Record<string, number>;
    project: Record<string, number>;
  };
}

