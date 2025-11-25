import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/services/auth/auth.service';
import { QuoteService } from '../../core/services/quote/quote.service';
import { InvoiceService } from '../../core/services/invoice/invoice.service';
import { PageLayoutComponent, type LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { MediaPreviewModalComponent } from '../../shared/ui/media-preview-modal/media-preview-modal.component';
import type { Quote, QuoteCustomer, Materials, MaterialItem } from '../../core/models/quote.model';
import type { Invoice } from '../../core/models/invoice.model';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { KitchenInputsService, type CategoryGroup, type KitchenInput } from '../../core/services/kitchen-inputs/kitchen-inputs.service';
import { PdfService } from '../../core/services/pdf/pdf.service';

@Component({
  selector: 'app-quote-detail-page',
  standalone: true,
  imports: [CommonModule, PageLayoutComponent, MediaPreviewModalComponent],
  templateUrl: './quote-detail.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly quoteService = inject(QuoteService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly inputsService = inject(KitchenInputsService);
  private readonly pdfService = inject(PdfService);

  protected readonly isLoading = signal(true);
  protected readonly quote = signal<Quote | null>(null);
  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly activeTab = signal<string>('kitchen-details');
  protected readonly previewMediaUrl = signal<string | null>(null);

  protected readonly isCustomer = computed(() => this.authService.user()?.role === 'customer');

  // Estructura agrupada de inputs
  protected readonly groupedInputs = computed<CategoryGroup[]>(() => {
    const quote = this.quote();
    if (!quote) return [];
    
    const experience = quote.experience?.toLowerCase() || 'basic';
    return this.inputsService.getOrderedGroupedInputs(experience);
  });

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const quote = this.quote();
    const projectId = quote?.projectId;
    
    if (!quote) {
      return [
        { label: 'Projects', route: '/customers' },
        { label: 'Quote Detail' }
      ];
    }

    return [
      { label: 'Projects', route: '/customers' }, // Asumiendo navegación desde lista de proyectos
      { label: 'Project Detail', route: `/projects/${projectId}` },
      { label: `Estimate v${quote.versionNumber}` }
    ];
  });

  constructor() {
    const quoteId = this.route.snapshot.paramMap.get('quoteId');
    if (quoteId) {
      this.loadQuote(quoteId);
    } else {
      this.notificationService.error('Error', 'Quote ID is missing');
      void this.router.navigate(['/']);
    }
  }

  private loadQuote(id: string): void {
    this.isLoading.set(true);
    this.quoteService.getQuote(id)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (quote) => {
          this.quote.set(quote);
          this.isLoading.set(false);
          this.loadInvoices(quote._id);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Error', `Could not load quote: ${message}`);
          this.isLoading.set(false);
        }
      });
  }

  private loadInvoices(quoteId: string): void {
    this.invoiceService.getInvoices({ quoteId }).subscribe({
      next: (invoices) => {
        this.invoices.set(invoices);
      },
      error: (error) => {
        console.error('Error loading invoices:', error);
      }
    });
  }

  // Helper para obtener el cliente de forma segura
  protected get customer(): QuoteCustomer | null {
    const quote = this.quote();
    if (quote && typeof quote.customerId === 'object' && quote.customerId !== null && 'name' in quote.customerId) {
      return quote.customerId as QuoteCustomer;
    }
    return null;
  }

  protected getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: 'bg-slate/20 text-slate',
      sent: 'bg-blue-500/20 text-blue-700',
      approved: 'bg-pine/20 text-pine',
      rejected: 'bg-red-500/20 text-red-700',
      in_progress: 'bg-yellow-500/20 text-yellow-700',
      completed: 'bg-green-600/20 text-green-700'
    };
    return colors[status] ?? 'bg-slate/20 text-slate';
  }

  protected getInvoiceStatusColor(status: string): string {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'partially_paid': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  protected formatDate(dateString?: string): string {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  }

  protected getKitchenInfoKeys(info: Record<string, unknown>): string[] {
    return Object.keys(info).filter(key => 
      !['countertopsFiles', 'backsplashFiles', 'audioNotes', 'sketchFiles', 'sketchFile', 'additionalComments', 'type'].includes(key)
    );
  }

  protected hasCategoryData(categoryGroup: CategoryGroup, quote: Quote): boolean {
    if (!quote.kitchenInformation) return false;
    
    // Verificar si alguna subcategoría tiene datos
    return categoryGroup.subcategories.some(sub => 
      sub.inputs.some(input => {
        const value = quote.kitchenInformation?.[input.name];
        // Consideramos que tiene datos si el valor no es null/undefined/false
        // Para checkboxes, false significa no seleccionado, así que lo excluimos
        // Para radio buttons, si es "No" (o false), tampoco lo mostramos idealmente
        return value !== null && value !== undefined && value !== false && value !== 'No' && value !== '';
      })
    );
  }

  protected getInputValue(input: KitchenInput, quote: Quote): unknown {
    return quote.kitchenInformation?.[input.name];
  }

  protected shouldShowInput(input: KitchenInput, quote: Quote): boolean {
    const value = this.getInputValue(input, quote);
    // Mostrar solo si tiene valor válido (no false, no null, no undefined, no vacío)
    // Excepción: el valor 0 sí debería mostrarse si es un número
    return value !== null && value !== undefined && value !== false && value !== '' && value !== 'No';
  }

  protected formatKey(key: string): string {
    // Convert camelCase to Title Case
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/Custom$/, '') // Remove 'Custom' suffix if present
      .trim();
  }

  protected isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  }

  protected isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|mkv|webm)$/i.test(url);
  }

  protected isPdfUrl(url: string): boolean {
    return url.toLowerCase().endsWith('.pdf');
  }

  /**
   * Obtiene los materials del quote de forma segura
   */
  protected getMaterials(): Materials | null {
    const quote = this.quote();
    if (!quote || !quote.materials) {
      return null;
    }
    
    // El backend puede enviar materials con _id adicional, lo ignoramos
    const materials = quote.materials as Materials;
    
    // Verificar que tenga al menos file o items
    if (!materials.file && (!materials.items || materials.items.length === 0)) {
      return null;
    }
    
    return materials;
  }

  /**
   * Verifica si hay materials para mostrar
   */
  protected hasMaterials(): boolean {
    const materials = this.getMaterials();
    if (!materials) return false;
    return !!(materials.file || (materials.items && materials.items.length > 0));
  }

  /**
   * Obtiene el archivo de materials si existe
   */
  protected getMaterialsFile(): string | null {
    const materials = this.getMaterials();
    return materials?.file || null;
  }

  /**
   * Obtiene los items de materials si existen
   */
  protected getMaterialsItems(): MaterialItem[] {
    const materials = this.getMaterials();
    return materials?.items || [];
  }

  protected setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }

  protected createInvoice(): void {
    const quote = this.quote();
    if (quote) {
      void this.router.navigate(['/quotes', quote._id, 'create-invoice']);
    }
  }

  protected viewInvoice(invoiceId: string): void {
    void this.router.navigate(['/invoices', invoiceId]);
  }

  protected async downloadPdf(): Promise<void> {
    const quote = this.quote();
    if (!quote) {
      return;
    }

    try {
      this.notificationService.info('Generating PDF', 'Please wait...');
      await this.pdfService.generateQuotePdf(quote, this.customer, this.groupedInputs());
      this.notificationService.success('PDF Generated', 'Your estimate PDF has been downloaded');
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.notificationService.error('PDF Generation Failed', 'Could not generate the PDF. Please try again.');
    }
  }

  /**
   * Abre el modal de previsualización de media
   */
  protected openMediaPreview(url: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.previewMediaUrl.set(url);
  }

  /**
   * Cierra el modal de previsualización
   */
  protected closeMediaPreview(): void {
    this.previewMediaUrl.set(null);
  }
}
