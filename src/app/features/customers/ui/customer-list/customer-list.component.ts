import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Customer } from '../../../../core/models/customer.model';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './customer-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerListComponent {
  @Input({ required: true }) customers: Customer[] = [];
  @Input({ required: true }) activeCustomerId: string | null = null;
  @Input({ required: true }) isBusy = false;

  @Output() readonly editCustomer = new EventEmitter<Customer>();
  @Output() readonly deleteCustomer = new EventEmitter<Customer>();

  protected trackById(_: number, customer: Customer): string {
    return customer._id;
  }

  protected edit(customer: Customer): void {
    this.editCustomer.emit(customer);
  }

  protected remove(customer: Customer): void {
    if (this.isBusy) {
      return;
    }
    this.deleteCustomer.emit(customer);
  }
}


