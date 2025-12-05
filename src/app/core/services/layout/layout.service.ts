import { Injectable, signal } from '@angular/core';
import type { LayoutBreadcrumb } from '../../../shared/ui/page-layout/page-layout.component';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  readonly breadcrumbs = signal<LayoutBreadcrumb[]>([]);
  readonly background = signal<string>('bg-sand/80');

  setBreadcrumbs(breadcrumbs: LayoutBreadcrumb[]): void {
    this.breadcrumbs.set(breadcrumbs);
  }

  setBackground(background: string): void {
    this.background.set(background);
  }

  clear(): void {
    this.breadcrumbs.set([]);
    this.background.set('bg-sand/80');
  }
}

