import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomerAddress } from '../../../../core/models/customer.model';

@Component({
  selector: 'app-address-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" (click)="close()">
        <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h2 class="mb-4 text-xl font-bold text-charcoal">
            {{ isEditing() ? 'Edit Address' : 'Add Address' }}
          </h2>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <!-- Label -->
            <div>
              <label class="mb-1 block text-sm font-medium text-charcoal">Label (e.g., Home, Work)</label>
              <input type="text" formControlName="label" class="w-full rounded-xl border border-fog/60 bg-white px-4 py-2 text-charcoal focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine" placeholder="Home">
            </div>

            <!-- Address -->
            <div>
              <label class="mb-1 block text-sm font-medium text-charcoal">Address</label>
              <input type="text" formControlName="address" class="w-full rounded-xl border border-fog/60 bg-white px-4 py-2 text-charcoal focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine" placeholder="123 Main St">
              @if (form.get('address')?.touched && form.get('address')?.hasError('required')) {
                <p class="mt-1 text-xs text-red-500">Address is required.</p>
              }
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- City -->
              <div>
                <label class="mb-1 block text-sm font-medium text-charcoal">City</label>
                <input type="text" formControlName="city" class="w-full rounded-xl border border-fog/60 bg-white px-4 py-2 text-charcoal focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine" placeholder="New York">
                @if (form.get('city')?.touched && form.get('city')?.hasError('required')) {
                  <p class="mt-1 text-xs text-red-500">City is required.</p>
                }
              </div>

              <!-- State -->
              <div>
                <label class="mb-1 block text-sm font-medium text-charcoal">State</label>
                <input type="text" formControlName="state" class="w-full rounded-xl border border-fog/60 bg-white px-4 py-2 text-charcoal focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine" placeholder="NY">
                @if (form.get('state')?.touched && form.get('state')?.hasError('required')) {
                  <p class="mt-1 text-xs text-red-500">State is required.</p>
                }
              </div>
            </div>

            <!-- Zip Code -->
            <div>
              <label class="mb-1 block text-sm font-medium text-charcoal">Zip Code</label>
              <input type="text" formControlName="zipCode" class="w-full rounded-xl border border-fog/60 bg-white px-4 py-2 text-charcoal focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine" placeholder="10001">
              @if (form.get('zipCode')?.touched && form.get('zipCode')?.hasError('required')) {
                <p class="mt-1 text-xs text-red-500">Zip code is required.</p>
              }
            </div>

            <!-- Is Primary -->
            <div class="flex items-center">
              <input type="checkbox" id="isPrimary" formControlName="isPrimary" class="h-4 w-4 rounded border-fog text-pine focus:ring-pine">
              <label for="isPrimary" class="ml-2 block text-sm text-slate">Set as primary address</label>
            </div>

            <!-- Actions -->
            <div class="mt-6 flex justify-end gap-3">
              <button type="button" (click)="close()" class="rounded-full border border-fog px-4 py-2 text-sm font-medium text-slate hover:bg-fog/10">
                Cancel
              </button>
              <button type="submit" [disabled]="form.invalid" class="rounded-full bg-pine px-6 py-2 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class AddressModalComponent {
  private readonly fb = inject(FormBuilder);

  save = output<CustomerAddress>();
  cancel = output<void>();

  protected readonly isOpen = signal(false);
  protected readonly isEditing = signal(false);

  protected readonly form = this.fb.group({
    label: [''],
    address: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
    zipCode: ['', Validators.required],
    isPrimary: [false]
  });

  open(address?: CustomerAddress) {
    this.isOpen.set(true);
    if (address) {
      this.isEditing.set(true);
      this.form.patchValue({
        label: address.label || '',
        address: address.address,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        isPrimary: address.isPrimary || false
      });
    } else {
      this.isEditing.set(false);
      this.form.reset({ isPrimary: false });
    }
  }

  close() {
    this.isOpen.set(false);
    this.cancel.emit();
  }

  onSubmit() {
    if (this.form.valid) {
      const value = this.form.getRawValue();
      const address: CustomerAddress = {
        label: value.label || undefined,
        address: value.address!,
        city: value.city!,
        state: value.state!,
        zipCode: value.zipCode!,
        isPrimary: value.isPrimary || false
      };
      this.save.emit(address);
      this.isOpen.set(false);
    }
  }
}
