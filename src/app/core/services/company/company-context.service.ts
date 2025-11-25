import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { Company } from '../../models/company.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyContextService {
  private readonly storageKey = 'ba:selected-company';
  private readonly router = inject(Router);

  private readonly selectedCompanySignal = signal<Company | null>(this.restore());

  readonly selectedCompany = this.selectedCompanySignal.asReadonly();
  readonly selectedCompanyId = computed(() => this.selectedCompanySignal()?. _id ?? null);

  setCompany(company: Company): void {
    this.selectedCompanySignal.set(company);
    this.persist(company);
  }

  clear(): void {
    this.selectedCompanySignal.set(null);
    this.persist(null);
  }

  async ensureSelectionOrRedirect(): Promise<void> {
    if (!this.selectedCompanySignal()) {
      await this.router.navigateByUrl('/company');
    }
  }

  private restore(): Company | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Company;
      return parsed?._id ? parsed : null;
    } catch (error) {
      console.warn('Unable to restore company context', error);
      return null;
    }
  }

  private persist(company: Company | null): void {
    if (company) {
      localStorage.setItem(this.storageKey, JSON.stringify(company));
      return;
    }

    localStorage.removeItem(this.storageKey);
  }
}


