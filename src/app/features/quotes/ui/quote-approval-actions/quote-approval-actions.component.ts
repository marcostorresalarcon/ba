import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  EventEmitter,
  Input,
  Output,
  signal
} from '@angular/core';
import type { Quote, QuoteStatus } from '../../../../core/models/quote.model';

@Component({
  selector: 'app-quote-approval-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quote-approval-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteApprovalActionsComponent {
  @Input({ required: true }) quote!: Quote;
  @Input() userRole?: string;

  @Output() readonly approve = new EventEmitter<void>();
  @Output() readonly reject = new EventEmitter<void>();
  @Output() readonly send = new EventEmitter<void>();
  @Output() readonly startWork = new EventEmitter<void>();
  @Output() readonly completeWork = new EventEmitter<void>();

  protected readonly isProcessing = signal(false);
  private readonly previousQuoteId = signal<string | null>(null);

  constructor() {
    // Resetear isProcessing cuando el quote cambia (operación completada)
    effect(() => {
      const currentQuoteId = this.quote?._id;
      const previousId = this.previousQuoteId();
      
      // Si el quote cambió y estábamos procesando, resetear
      if (currentQuoteId && previousId && currentQuoteId !== previousId && this.isProcessing()) {
        setTimeout(() => {
          this.isProcessing.set(false);
        }, 100);
      }
      
      // Actualizar el ID anterior
      if (currentQuoteId) {
        this.previousQuoteId.set(currentQuoteId);
      }
    });
  }

  /**
   * Ya no se necesita canSend - las cotizaciones se crean directamente en 'sent'
   * Este getter se mantiene por compatibilidad pero siempre retorna false
   */
  protected get canSend(): boolean {
    return false; // Las cotizaciones se crean directamente en 'sent', no hay transición desde 'pending'
  }

  /**
   * Customer puede aprobar cuando la cotización está en 'sent'
   */
  protected get canCustomerApprove(): boolean {
    return this.quote.status === 'sent' && this.isCustomer();
  }

  /**
   * Customer puede rechazar cuando la cotización está en 'sent'
   */
  protected get canCustomerReject(): boolean {
    return this.quote.status === 'sent' && this.isCustomer();
  }

  /**
   * Estimator/Admin puede iniciar trabajo cuando la cotización está en 'sent' o 'approved'
   */
  protected get canStartWork(): boolean {
    return (this.quote.status === 'sent' || this.quote.status === 'approved') && this.isAdminOrEstimator();
  }

  /**
   * Estimator/Admin puede completar trabajo cuando la cotización está en 'in_progress'
   */
  protected get canCompleteWork(): boolean {
    return this.quote.status === 'in_progress' && this.isAdminOrEstimator();
  }

  protected get showActions(): boolean {
    return (
      this.canSend ||
      this.canCustomerApprove ||
      this.canCustomerReject ||
      this.canStartWork ||
      this.canCompleteWork
    );
  }

  private isAdminOrEstimator(): boolean {
    return this.userRole === 'admin' || this.userRole === 'estimator';
  }

  private isCustomer(): boolean {
    return this.userRole === 'customer';
  }

  protected handleApprove(): void {
    if (!this.isProcessing()) {
      this.isProcessing.set(true);
      this.approve.emit();
    }
  }

  protected handleReject(): void {
    if (!this.isProcessing()) {
      this.reject.emit();
    }
  }

  protected handleSend(): void {
    if (!this.isProcessing()) {
      this.isProcessing.set(true);
      this.send.emit();
    }
  }

  protected handleStartWork(): void {
    if (!this.isProcessing()) {
      this.isProcessing.set(true);
      this.startWork.emit();
    }
  }

  protected handleCompleteWork(): void {
    if (!this.isProcessing()) {
      this.isProcessing.set(true);
      this.completeWork.emit();
    }
  }

  protected resetProcessing(): void {
    this.isProcessing.set(false);
  }
}
