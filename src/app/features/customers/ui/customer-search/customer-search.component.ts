import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal
} from '@angular/core';

@Component({
  selector: 'app-customer-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customer-search.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerSearchComponent {
  protected readonly isFocused = signal(false);

  @Input({ required: true }) query = '';
  @Input({ required: true }) suggestions: string[] = [];

  @Output() readonly queryChange = new EventEmitter<string>();
  @Output() readonly suggestionSelected = new EventEmitter<string>();

  protected handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.queryChange.emit(target.value);
  }

  protected selectSuggestion(value: string): void {
    this.suggestionSelected.emit(value);
  }

  protected focusState(state: boolean): void {
    this.isFocused.set(state);
  }
}


