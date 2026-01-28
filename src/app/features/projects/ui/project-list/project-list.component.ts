import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ProjectWithQuoteCount } from '../../../../core/models/project.model';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectListComponent {
  @Input({ required: true }) projects: ProjectWithQuoteCount[] = [];
  @Input({ required: true }) isLoading = false;
  @Input({ required: false }) isDeleting = false;
  @Input({ required: false }) readonly = false;
  @Input({ required: false }) showContainer = true;
  @Input({ required: false }) showHeader = true;

  @Output() readonly editProject = new EventEmitter<ProjectWithQuoteCount>();
  @Output() readonly deleteProject = new EventEmitter<ProjectWithQuoteCount>();

  protected trackById(_: number, project: ProjectWithQuoteCount): string {
    return project._id;
  }

  protected getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'bg-slate/20 text-slate',
      in_progress: 'bg-pine/20 text-pine',
      on_hold: 'bg-clay/20 text-clay',
      completed: 'bg-green-600/20 text-green-700',
      cancelled: 'bg-red-500/20 text-red-700'
    };
    return colors[status] ?? 'bg-slate/20 text-slate';
  }

  protected getTypeLabel(type?: string | null): string {
    if (!type) {
      return 'General';
    }

    const map: Record<string, string> = {
      kitchen: 'Kitchen',
      bathroom: 'Bathroom',
      basement: 'Basement',
      'additional-work': 'Additional Work'
    };
    return map[type] ?? type.replace('_', ' ');
  }

  protected edit(project: ProjectWithQuoteCount, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.editProject.emit(project);
  }

  protected remove(project: ProjectWithQuoteCount, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.deleteProject.emit(project);
  }
}

