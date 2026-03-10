import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import type { Comment } from '../../../../core/models/comment.model';
import { CommentService } from '../../../../core/services/comment/comment.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { HttpErrorService } from '../../../../core/services/error/http-error.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';

@Component({
  selector: 'app-project-comments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './project-comments.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectCommentsComponent {
  private readonly commentService = inject(CommentService);
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly projectId = input.required<string>();

  protected readonly comments = signal<Comment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly editingId = signal<string | null>(null);

  protected readonly currentUserId = computed(() => this.authService.user()?.id ?? null);

  protected readonly form = this.fb.group({
    text: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(2000)]]
  });

  protected readonly editForm = this.fb.group({
    text: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(2000)]]
  });

  constructor() {
    effect(() => {
      const id = this.projectId();
      if (id) this.loadComments();
    });
  }

  protected loadComments(): void {
    const id = this.projectId();
    if (!id) return;
    this.isLoading.set(true);
    this.commentService
      .getCommentsByProject(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (list) => this.comments.set(list),
        error: (err) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error loading comments', msg);
        }
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const text = this.form.getRawValue().text?.trim() ?? '';
    const id = this.projectId();
    if (!text || !id) return;

    this.isSubmitting.set(true);
    this.commentService
      .createComment(id, text)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: (newComment) => {
          this.comments.update((list) => [...list, newComment]);
          this.form.reset();
          this.notificationService.success('Comment added', '');
        },
        error: (err) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error adding comment', msg);
        }
      });
  }

  protected startEdit(comment: Comment): void {
    this.editingId.set(comment._id);
    this.editForm.patchValue({ text: comment.text });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editForm.reset();
  }

  protected saveEdit(): void {
    const id = this.editingId();
    if (!id || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const text = this.editForm.getRawValue().text?.trim() ?? '';
    if (!text) return;

    this.commentService
      .updateComment(id, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.comments.update((list) =>
            list.map((c) => (c._id === id ? updated : c))
          );
          this.editingId.set(null);
          this.editForm.reset();
          this.notificationService.success('Comment updated', '');
        },
        error: (err) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error updating comment', msg);
        }
      });
  }

  protected deleteComment(comment: Comment): void {
    if (!confirm('Delete this comment?')) return;

    this.commentService
      .deleteComment(comment._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.comments.update((list) => list.filter((c) => c._id !== comment._id));
          this.notificationService.success('Comment deleted', '');
        },
        error: (err) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error deleting comment', msg);
        }
      });
  }

  protected isOwnComment(comment: Comment): boolean {
    const uid = this.currentUserId();
    return !!uid && comment.userId === uid;
  }

  protected formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
