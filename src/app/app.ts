import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NotificationCenterComponent } from './shared/ui/notification-center/notification-center.component';
import { BackButtonService } from './core/services/navigation/back-button.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NotificationCenterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  private readonly backButtonService = inject(BackButtonService);

  ngOnInit(): void {
    // Inicializar el manejo del botón de atrás
    this.backButtonService.initialize();
  }
}
