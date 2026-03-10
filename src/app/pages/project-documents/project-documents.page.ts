import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize } from 'rxjs';

import { ProjectService } from '../../core/services/project/project.service';
import { QuoteService } from '../../core/services/quote/quote.service';
import type { Project } from '../../core/models/project.model';
import type { Quote } from '../../core/models/quote.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

export interface DocumentItem {
  url: string;
  label: string;
  source: string;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'other';
}

@Component({
  selector: 'app-project-documents-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-documents.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDocumentsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly quoteService = inject(QuoteService);
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly documents = signal<DocumentItem[]>([]);
  protected readonly isLoading = signal(true);

  protected readonly isCustomer = signal(this.authService.user()?.role === 'customer');

  protected readonly breadcrumbs = signal<LayoutBreadcrumb[]>([]);

  constructor() {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) {
      this.projectId.set(projectId);
      this.loadData(projectId);
    }

    effect(() => {
      const id = this.projectId();
      const proj = this.project();
      const customer = this.isCustomer();
      if (id && proj) {
        const crumbs: LayoutBreadcrumb[] = customer
          ? [
              { label: 'My Projects', route: '/my-projects' },
              { label: proj.name, route: `/projects/${id}` },
              { label: 'Documents' },
            ]
          : [
              { label: 'Projects', route: '/projects' },
              { label: proj.name, route: `/projects/${id}` },
              { label: 'Documents' },
            ];
        this.breadcrumbs.set(crumbs);
      }
    });

    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs());
    });
  }

  private loadData(projectId: string): void {
    this.isLoading.set(true);

    forkJoin({
      project: this.projectService.getProject(projectId),
      quotes: this.quoteService.getQuotesByProject(projectId),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: ({ project, quotes }) => {
          this.project.set(project);
          const docs = this.aggregateDocuments(quotes, project);
          this.documents.set(docs);
        },
        error: (err) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Unable to load documents', msg);
          void this.router.navigateByUrl(this.isCustomer() ? '/my-projects' : '/projects');
        },
      });
  }

  private aggregateDocuments(quotes: Quote[], proj: Project | null): DocumentItem[] {
    const items: DocumentItem[] = [];

    if (proj?.photos?.length) {
      for (const url of proj.photos) {
        items.push({ url, label: 'Project photo', source: 'Project', type: this.getFileType(url) });
      }
    }

    for (const q of quotes) {
      const source = `Estimate v${q.versionNumber} (${q.category})`;

      if (q.pdfUrl) {
        items.push({
          url: q.pdfUrl,
          label: `Proposal v${q.versionNumber}`,
          source,
          type: 'pdf',
        });
      }

      const addUrls = (urls: string[] | null | undefined, label: string) => {
        urls?.forEach((url) => {
          items.push({ url, label, source, type: this.getFileType(url) });
        });
      };

      addUrls(q.countertopsFiles, 'Countertops');
      addUrls(q.backsplashFiles, 'Backsplash');
      addUrls(q.sketchFiles, 'Sketch');
      addUrls(q.additionalComments?.mediaFiles ?? null, 'Additional media');
      addUrls(q.rejectionComments?.mediaFiles ?? null, 'Rejection attachment');

      if (q.materials?.file) {
        items.push({
          url: q.materials.file,
          label: 'Materials',
          source,
          type: this.getFileType(q.materials.file),
        });
      }

      q.audioNotes?.forEach((a, i) => {
        if (a.url) {
          items.push({
            url: a.url,
            label: `Audio note ${i + 1}`,
            source,
            type: 'audio',
          });
        }
      });
    }

    return items;
  }

  private getFileType(url: string): DocumentItem['type'] {
    const ext = url.split('.').pop()?.toLowerCase() ?? '';
    const lower = url.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || lower.includes('image')) return 'image';
    if (['mp4', 'mov', 'webm', 'avi'].includes(ext) || lower.includes('video')) return 'video';
    if (['mp3', 'm4a', 'wav'].includes(ext) || lower.includes('audio')) return 'audio';
    if (ext === 'pdf' || lower.includes('pdf')) return 'pdf';
    return 'other';
  }
}
