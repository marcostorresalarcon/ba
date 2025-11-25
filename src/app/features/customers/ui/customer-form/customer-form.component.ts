import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import type { OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FormControl, FormGroup } from '@angular/forms';

import type { Customer, CustomerPayload } from '../../../../core/models/customer.model';

export type CustomerFormValue = Omit<CustomerPayload, 'companyId'>;

type CustomerFormGroup = FormGroup<{
  name: FormControl<string>;
  lastName: FormControl<string>;
  phone: FormControl<string>;
  date: FormControl<string>;
  email: FormControl<string>;
  address: FormControl<string>;
  city: FormControl<string>;
  zipCode: FormControl<string>;
  state: FormControl<string>;
  leadSource: FormControl<string>;
  description: FormControl<string>;
}>;

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './customer-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  protected readonly form: CustomerFormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    phone: [''],
    date: [''],
    email: ['', [Validators.email]],
    address: [''],
    city: [''],
    zipCode: [''],
    state: [''],
    leadSource: [''],
    description: ['']
  });

  @Input({ required: false }) customer: Customer | null = null;
  @Input({ required: true }) isSubmitting = false;

  @Output() readonly submitCustomer = new EventEmitter<CustomerFormValue>();
  @Output() readonly cancelEdit = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customer']) {
      const value = changes['customer'].currentValue as Customer | null;
      if (value) {
        this.form.patchValue({
          name: value.name,
          lastName: value.lastName,
          phone: value.phone ?? '',
          date: value.date ?? '',
          email: value.email ?? '',
          address: value.address ?? '',
          city: value.city ?? '',
          zipCode: value.zipCode ?? '',
          state: value.state ?? '',
          leadSource: value.leadSource ?? '',
          description: value.description ?? ''
        });
      } else {
        this.form.reset({
          name: '',
          lastName: '',
          phone: '',
          date: '',
          email: '',
          address: '',
          city: '',
          zipCode: '',
          state: '',
          leadSource: '',
          description: ''
        });
      }
    }
  }

  protected submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();
    this.submitCustomer.emit(payload);
  }
}


