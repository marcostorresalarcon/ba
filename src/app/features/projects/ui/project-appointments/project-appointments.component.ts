import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import type { Appointment } from '../../../../core/models/appointment.model';
import { AppointmentService } from '../../../../core/services/appointment/appointment.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { HttpErrorService } from '../../../../core/services/error/http-error.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';

@Component({
  selector: 'app-project-appointments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './project-appointments.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectAppointmentsComponent {
  private readonly appointmentService = inject(AppointmentService);
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly projectId = input.required<string>();

  protected readonly showCreateForm = signal(false);
  protected readonly isCreating = signal(false);
  protected readonly createForm = this.fb.group({
    date: ['', Validators.required],
    time: ['09:00', Validators.required],
    type: ['other', Validators.required],
    notes: ['']
  });

  protected readonly appointments = signal<Appointment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly confirmingId = signal<string | null>(null);

  protected readonly isCustomer = computed(() => this.authService.user()?.role === 'customer');
  protected readonly isStaff = computed(
    () =>
      this.authService.user()?.role === 'administrator' ||
      this.authService.user()?.role === 'admin' ||
      this.authService.user()?.role === 'estimator'
  );

  constructor() {
    effect(() => {
      const id = this.projectId();
      if (id) this.loadAppointments();
    });
  }

  protected loadAppointments(): void {
    const id = this.projectId();
    if (!id) return;
    this.isLoading.set(true);
    this.appointmentService
      .getByProject(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (list) => this.appointments.set(list),
        error: (err: unknown) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error loading appointments', msg);
        }
      });
  }

  protected confirmAppointment(apt: Appointment): void {
    if (apt.status === 'confirmed') return;
    this.confirmingId.set(apt._id);
    this.appointmentService
      .confirm(apt._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.appointments.update((list) =>
            list.map((a) => (a._id === apt._id ? updated : a))
          );
          this.confirmingId.set(null);
          this.notificationService.success('Appointment confirmed', '');
        },
        error: (err: unknown) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error confirming appointment', msg);
          this.confirmingId.set(null);
        }
      });
  }

  protected formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short'
    });
  }

  protected typeLabel(type: string): string {
    const labels: Record<string, string> = {
      measurement: 'Measurement',
      installation: 'Installation',
      inspection: 'Inspection',
      consultation: 'Consultation',
      other: 'Other'
    };
    return labels[type] ?? type;
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      scheduled: 'Scheduled',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return labels[status] ?? status;
  }

  protected toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    if (!this.showCreateForm()) this.createForm.reset({ date: '', time: '09:00', type: 'other', notes: '' });
  }

  protected onSubmitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const id = this.projectId();
    if (!id) return;
    const { date, time, type, notes } = this.createForm.getRawValue();
    const dateObj = new Date(`${date}T${time ?? '09:00'}`);
    this.isCreating.set(true);
    this.appointmentService
      .create(id, dateObj, type ?? 'other', notes || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isCreating.set(false)))
      .subscribe({
        next: (newApt) => {
          this.appointments.update((list) => [...list, newApt].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
          this.showCreateForm.set(false);
          this.createForm.reset({ date: '', time: '09:00', type: 'other', notes: '' });
          this.notificationService.success('Appointment created', 'SMS sent to customer if phone is on file.');
        },
        error: (err: unknown) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error creating appointment', msg);
        }
      });
  }
}
