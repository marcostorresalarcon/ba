import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { LayoutService } from '../../core/services/layout/layout.service';
import { SUPPORT_CONTACT, SUPPORT_FAQS } from '../../core/constants/support.constants';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-support-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './support.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportPage {
  private readonly layoutService = inject(LayoutService);

  protected readonly contact = SUPPORT_CONTACT;
  protected readonly faqs = SUPPORT_FAQS;
  protected readonly isNative = Capacitor.isNativePlatform();

  protected readonly breadcrumbs: LayoutBreadcrumb[] = [{ label: 'Support', route: '/support' }];

  constructor() {
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs);
    });
  }

  protected openTel(): void {
    window.open(`tel:${this.contact.phone.replace(/\D/g, '')}`, '_self');
  }

  protected openSms(): void {
    window.open(`sms:${this.contact.smsNumber}`, '_self');
  }

  protected openEmail(): void {
    window.location.href = `mailto:${this.contact.email}`;
  }

  protected openWeb(): void {
    window.open(this.contact.web, '_blank');
  }
}
