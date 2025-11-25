import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import type { Company } from '../../../../core/models/company.model';

@Component({
  selector: 'app-company-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanyCardComponent {
  @Input({ required: true }) company!: Company;
  @Input({ required: true }) isSelected = false;
  @Input({ required: false }) logoUrl: string | null = null;

  @Output() readonly selectCompany = new EventEmitter<Company>();

  protected handleClick(): void {
    this.selectCompany.emit(this.company);
  }

  protected buildInitials(name: string): string {
    return name
      .split(' ')
      .filter((part) => Boolean(part))
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}


