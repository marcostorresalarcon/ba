import { CommonModule, Location } from '@angular/common';
import type { OnInit} from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { FormArray, FormGroup} from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InvoiceService } from '../../../../core/services/invoice/invoice.service';
import { QuoteService } from '../../../../core/services/quote/quote.service';
import { ProjectService } from '../../../../core/services/project/project.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';
import type { Quote } from '../../../../core/models/quote.model';
import type { Project } from '../../../../core/models/project.model';
import type { LayoutBreadcrumb } from '../../../../shared/ui/page-layout/page-layout.component';
import { PageLayoutComponent } from '../../../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-invoice-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageLayoutComponent],
  templateUrl: './invoice-create.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly invoiceService = inject(InvoiceService);
  private readonly quoteService = inject(QuoteService);
  private readonly projectService = inject(ProjectService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly location = inject(Location);

  protected readonly quoteId = this.route.snapshot.paramMap.get('quoteId');
  protected readonly quote = signal<Quote | null>(null);
  protected readonly project = signal<Project | null>(null);
  
  protected readonly form = this.fb.group({
    paymentPlan: this.fb.array([])
  });

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    return [
      { label: 'Invoices', route: '/invoices' },
      { label: 'Create Invoice' }
    ];
  });

  protected readonly totalPercentage = computed(() => {
    const plan = this.form.controls.paymentPlan.value;
    return plan.reduce((sum: number, item: any) => sum + (item?.percentage || 0), 0);
  });

  protected readonly totalAmount = computed(() => this.quote()?.totalPrice || 0);

  ngOnInit(): void {
    if (!this.quoteId) {
      this.notificationService.error('Error', 'No Quote ID provided');
      return;
    }

    this.quoteService.getQuote(this.quoteId).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        
        // Handle projectId which might be a string or an object (populated)
        const projectId: any = quote.projectId;
        
        if (projectId && typeof projectId === 'object' && projectId._id) {
           // It's already populated
           // Assuming the object structure matches Project partially or fully
           // We can cast it or just set it if structure matches enough for UI (name)
           this.project.set(projectId as Project);
        } else if (projectId && typeof projectId === 'string') {
          // It's an ID, fetch it
          this.projectService.getProject(projectId).subscribe({
            next: (project) => this.project.set(project),
            error: () => console.warn('Could not load project info')
          });
        }

        // Default: 2 installments (50/50) or 1 (100)
        this.addInstallment('Advance', 50);
        this.addInstallment('Final Payment', 50);
      },
      error: () => this.notificationService.error('Error', 'Could not load quote')
    });
  }

  get paymentPlanArray(): FormArray<FormGroup> {
    return this.form.controls.paymentPlan as unknown as FormArray<FormGroup>;
  }

  addInstallment(name = '', percentage = 0): void {
    const group = this.fb.group({
      name: [name, Validators.required],
      percentage: [percentage, [Validators.required, Validators.min(1), Validators.max(100)]]
    });
    this.paymentPlanArray.push(group);
  }

  removeInstallment(index: number): void {
    this.paymentPlanArray.removeAt(index);
  }

  calculateAmount(percentage: number): number {
    return (this.totalAmount() * percentage) / 100;
  }

  cancel(): void {
    this.location.back();
  }

  submit(): void {
    if (this.form.invalid) return;
    if (Math.abs(this.totalPercentage() - 100) > 0.1) {
      this.notificationService.error('Validation Error', 'Total percentage must be 100%');
      return;
    }

    const payload = {
      quoteId: this.quoteId!,
      paymentPlan: (this.form.value.paymentPlan || []).map((item: any) => ({
        name: item.name,
        percentage: Number(item.percentage)
      }))
    };

    console.log('Creating invoice with payload:', payload);

    this.invoiceService.createInvoice(payload).subscribe({
      next: (invoice) => {
        this.notificationService.success('Success', 'Invoice created successfully');
        this.router.navigate(['/invoices', invoice._id]); // Navigate to invoice detail
      },
      error: (error) => {
        console.error('Create invoice error:', error);
        this.notificationService.error('Error', `Could not create invoice: ${error.status} ${error.statusText}`);
      }
    });
  }
}
