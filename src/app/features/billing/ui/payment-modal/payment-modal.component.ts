import type { ElementRef, OnInit} from '@angular/core';
import { Component, EventEmitter, inject, Input, Output, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Stripe, StripeCardElement, StripeElements } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '../../../../../environments/environment';
import { PaymentService } from '../../../../core/services/payment/payment.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-modal.component.html',
  styles: [`
    :host { 
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
  `]
})
export class PaymentModalComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly notificationService = inject(NotificationService);

  @Input({ required: true }) invoiceId!: string;
  @Input({ required: true }) amount!: number;
  @Input({ required: true }) installmentIndex!: number;
  @Input() installmentName!: string;

  @Output() close = new EventEmitter<'success' | 'cancel'>();

  @ViewChild('cardElement') cardElementRef!: ElementRef;

  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  card: StripeCardElement | null = null;
  
  isProcessing = signal(false);
  cardError = signal<string | null>(null);

  async ngOnInit() {
    this.stripe = await loadStripe(environment.stripePublicKey);
    if (!this.stripe) {
      this.notificationService.error('Error', 'Failed to load Stripe');
      return;
    }

    this.elements = this.stripe.elements();
    this.card = this.elements.create('card', {
      style: {
        base: {
          color: '#32325d',
          fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
          fontSmoothing: 'antialiased',
          fontSize: '16px',
          '::placeholder': {
            color: '#aab7c4'
          }
        },
        invalid: {
          color: '#fa755a',
          iconColor: '#fa755a'
        }
      }
    });
    this.card.mount(this.cardElementRef.nativeElement);
    
    this.card.on('change', (event) => {
      this.cardError.set(event.error ? event.error.message : null);
    });
  }

  async pay() {
    if (this.isProcessing() || !this.stripe || !this.card) return;
    this.isProcessing.set(true);

    try {
      // Step 1: Create Intent
      const intentResponse = await this.paymentService.createPaymentIntent({
        invoiceId: this.invoiceId,
        amount: this.amount,
        installmentIndex: this.installmentIndex
      }).toPromise();

      if (!intentResponse?.clientSecret) {
        throw new Error('No client secret returned');
      }

      // Step 2: Confirm Payment
      const result = await this.stripe.confirmCardPayment(intentResponse.clientSecret, {
        payment_method: {
          card: this.card,
          billing_details: {
            // name: 'Customer Name' // Ideally passed as input
          }
        }
      });

      if (result.error) {
        this.notificationService.error('Payment Failed', result.error.message || 'Unknown error');
        this.isProcessing.set(false);
      } else if (result.paymentIntent?.status === 'succeeded') {
        // Step 3: Confirm backend
        await this.paymentService.confirmPayment({
          paymentIntentId: result.paymentIntent.id,
          invoiceId: this.invoiceId,
          installmentIndex: this.installmentIndex
        }).toPromise();

        this.notificationService.success('Success', 'Payment successful!');
        this.close.emit('success');
      }
    } catch (error) {
      console.error(error);
      this.notificationService.error('Error', 'Payment processing failed');
      this.isProcessing.set(false);
    }
  }

  cancel() {
    this.close.emit('cancel');
  }
}

