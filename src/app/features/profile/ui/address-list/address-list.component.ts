import { Component, input, output, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerAddress } from '../../../../core/models/customer.model';
import { AddressModalComponent } from '../address-modal/address-modal.component';

@Component({
  selector: 'app-address-list',
  standalone: true,
  imports: [CommonModule, AddressModalComponent],
  template: `
    <section class="rounded-[2.5rem] border border-fog/60 bg-white/95 p-6 shadow-brand">
      <div class="mb-6 flex items-center justify-between">
        <h2 class="font-display text-2xl text-charcoal">Addresses</h2>
        <button (click)="onAddAddress()" class="flex items-center gap-2 rounded-full bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine/90 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Address
        </button>
      </div>

      @if (addresses().length === 0) {
        <div class="rounded-xl border border-dashed border-fog p-8 text-center text-slate">
          No addresses found. Add one to get started.
        </div>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          @for (addr of addresses(); track $index) {
            <div class="group relative rounded-xl border border-fog/40 bg-sand/20 p-4 transition-all hover:border-pine/30 hover:shadow-sm">
              @if (addr.isPrimary) {
                <span class="absolute right-4 top-4 rounded-full bg-pine/10 px-2 py-1 text-xs font-medium text-pine">
                  Primary
                </span>
              }

              <div class="mb-2 pr-12">
                @if (addr.label) {
                  <h3 class="font-medium text-charcoal">{{ addr.label }}</h3>
                }
                <p class="text-sm text-slate">{{ addr.address }}</p>
                <p class="text-sm text-slate">{{ addr.city }}, {{ addr.state }} {{ addr.zipCode }}</p>
              </div>

              <div class="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button (click)="onEditAddress(addr, $index)" class="rounded-full bg-white px-3 py-1 text-xs font-medium text-charcoal shadow-sm hover:bg-fog/20 border border-fog/20 transition-colors">
                  Edit
                </button>
                <button (click)="onDeleteAddress($index)" class="rounded-full bg-white px-3 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 border border-fog/20 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          }
        </div>
      }

      <app-address-modal 
        (save)="onSaveAddress($event)" 
        (cancel)="onCancelModal()"
      ></app-address-modal>
    </section>
  `
})
export class AddressListComponent {
  addresses = input.required<CustomerAddress[]>();

  addAddress = output<CustomerAddress>();
  editAddress = output<{ address: CustomerAddress; index: number }>();
  deleteAddress = output<number>();

  readonly modal = viewChild(AddressModalComponent);
  
  private editingIndex: number | null = null;

  onAddAddress() {
    this.editingIndex = null;
    this.modal()?.open();
  }

  onEditAddress(address: CustomerAddress, index: number) {
    this.editingIndex = index;
    this.modal()?.open(address);
  }

  onDeleteAddress(index: number) {
    if (confirm('Are you sure you want to delete this address?')) {
      this.deleteAddress.emit(index);
    }
  }

  onSaveAddress(address: CustomerAddress) {
    if (this.editingIndex !== null) {
      this.editAddress.emit({ address, index: this.editingIndex });
    } else {
      this.addAddress.emit(address);
    }
    this.editingIndex = null;
  }

  onCancelModal() {
    this.editingIndex = null;
  }
}
