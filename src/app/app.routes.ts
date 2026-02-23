import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'media-preview',
    loadComponent: () =>
      import('./pages/media-preview/media-preview.page').then((m) => m.MediaPreviewPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage)
  },
  {
    path: 'company',
    loadComponent: () =>
      import('./pages/company-selection/company-selection.page').then((m) => m.CompanySelectionPage)
  },
  {
    path: 'drawing-canvas',
    loadComponent: () =>
      import('./pages/drawing-canvas/drawing-canvas.page').then((m) => m.DrawingCanvasPage)
  },
  {
    path: '',
    loadComponent: () =>
      import('./shared/ui/page-layout/page-layout.component').then((m) => m.PageLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin-dashboard/admin-dashboard.page').then((m) => m.AdminDashboardPage)
      },
      {
        path: 'sales-intelligence',
        loadComponent: () =>
          import('./pages/sales-dashboard/sales-dashboard.page').then((m) => m.SalesDashboardPage)
      },
      {
        path: 'my-projects',
        loadComponent: () =>
          import('./pages/my-projects/my-projects.page').then((m) => m.MyProjectsPage)
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./pages/customers/customers.page').then((m) => m.CustomersPage)
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./pages/projects/projects.page').then((m) => m.ProjectsPage)
      },
      {
        path: 'quotes',
        loadComponent: () =>
          import('./pages/quotes/quotes.page').then((m) => m.QuotesPage)
      },
      {
        path: 'customers/:customerId/projects',
        loadComponent: () =>
          import('./pages/customer-projects/customer-projects.page').then((m) => m.CustomerProjectsPage)
      },
      {
        path: 'projects/:projectId',
        loadComponent: () =>
          import('./pages/project-detail/project-detail.page').then((m) => m.ProjectDetailPage)
      },
      {
        path: 'projects/:projectId/quotes/select-category',
        loadComponent: () =>
          import('./pages/quote-select-category/quote-select-category.page').then((m) => m.QuoteSelectCategoryPage)
      },
      {
        path: 'projects/:projectId/quotes/select-experience',
        loadComponent: () =>
          import('./pages/quote-select-experience/quote-select-experience.page').then((m) => m.QuoteSelectExperiencePage)
      },
      {
        path: 'projects/:projectId/quotes/kitchen/create',
        loadComponent: () =>
          import('./pages/quote-create-kitchen/quote-create-kitchen.page').then((m) => m.QuoteCreateKitchenPage)
      },
      {
        path: 'projects/:projectId/quotes/additional-work/create',
        loadComponent: () =>
          import('./pages/quote-create-additional-work/quote-create-additional-work.page').then((m) => m.QuoteCreateAdditionalWorkPage)
      },
      {
        path: 'projects/:projectId/quotes/:category/create',
        loadComponent: () =>
          import('./pages/quote-create-generic/quote-create-generic.page').then((m) => m.QuoteCreateGenericPage)
      },
      {
        path: 'quotes/:quoteId',
        loadComponent: () =>
          import('./pages/quote-detail/quote-detail.page').then((m) => m.QuoteDetailPage)
      },
      {
        path: 'quotes/:quoteId/create-invoice',
        loadComponent: () =>
          import('./features/billing/ui/invoice-create/invoice-create.component').then((m) => m.InvoiceCreateComponent)
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/billing/ui/invoice-list/invoice-list.component').then((m) => m.InvoiceListComponent)
      },
      {
        path: 'invoices/:id',
        loadComponent: () =>
          import('./features/billing/ui/invoice-detail/invoice-detail.component').then((m) => m.InvoiceDetailComponent)
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users.page').then((m) => m.UsersPage)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.page').then((m) => m.SettingsPage)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
