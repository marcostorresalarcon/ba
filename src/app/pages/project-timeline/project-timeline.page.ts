import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ProjectService, type TimelineItem } from '../../core/services/project/project.service';
import { Project } from '../../core/models/project.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-project-timeline-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-timeline.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTimelinePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly timeline = signal<TimelineItem[]>([]);
  protected readonly isLoading = signal(true);

  protected readonly isCustomer = signal(this.authService.user()?.role === 'customer');

  protected readonly breadcrumbs = signal<LayoutBreadcrumb[]>([]);

  constructor() {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) {
      this.projectId.set(projectId);
      this.loadProjectAndTimeline(projectId);
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
              { label: 'Timeline' },
            ]
          : [
              { label: 'Projects', route: '/projects' },
              { label: proj.name, route: `/projects/${id}` },
              { label: 'Timeline' },
            ];
        this.breadcrumbs.set(crumbs);
      }
    });

    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs());
    });
  }

  private loadProjectAndTimeline(projectId: string): void {
    this.isLoading.set(true);

    this.projectService
      .getProject(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (proj) => this.project.set(proj),
        error: (err) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Unable to load project', msg);
          void this.router.navigateByUrl(this.isCustomer() ? '/my-projects' : '/projects');
        },
      });

    this.projectService
      .getTimeline(projectId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (items) => this.timeline.set(items),
        error: (err) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Unable to load timeline', msg);
        },
      });
  }

  protected formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected getTypeIcon(type: TimelineItem['type']): string {
    switch (type) {
      case 'status':
        return '↔';
      case 'update':
        return '📝';
      case 'milestone':
        return '🎯';
      default:
        return '•';
    }
  }
}
