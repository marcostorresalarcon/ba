import { CommonModule } from '@angular/common';
import type {
  OnInit
} from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  DestroyRef,
  inject,
  ChangeDetectorRef,
  computed,
  signal
} from '@angular/core';
import type { FormControl } from '@angular/forms';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { KitchenQuoteFormGroup } from '../../kitchen-quote-form.types';

@Component({
  selector: 'app-kitchen-details-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  templateUrl: './kitchen-details-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KitchenDetailsTabComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) form!: KitchenQuoteFormGroup;
  @Input({ required: true }) selectedKitchenType!: string;

  // Ya no necesitamos estos signals porque formControlName maneja automáticamente la selección

  protected readonly ceilingHeightOptions = [
    { label: '8 FEET', value: '8' },
    { label: '9 FEET', value: '9' },
    { label: '10 FEET', value: '10' },
    { label: 'Custom', value: 'custom' }
  ];

  protected readonly wallCabinetHeightOptions = [
    { label: '30 INCH', value: '30' },
    { label: '36 INCH', value: '36' },
    { label: '42 INCH', value: '42' },
    { label: 'Custom', value: 'custom' }
  ];

  protected readonly stackerOptions = [
    { label: 'No stackers', value: 'none' },
    { label: '12 INCH', value: '12' },
    { label: '15 INCH', value: '15' },
    { label: '18 INCH', value: '18' },
    { label: 'Custom', value: 'custom' }
  ];

  protected readonly locationKitchenOptions = [
    { value: 'mainFloor', label: 'Main Floor' },
    { value: 'upstairs', label: 'Upstairs' },
    { value: 'basement', label: 'Basement' },
    { value: 'skyScraper', label: 'Sky Scraper (tall building)' }
  ];

  protected readonly subFloorOptions = [
    { value: 'basementFinished', label: 'Basement FINISHED' },
    { value: 'basementUnfinished', label: 'Basement UNFINISHED' },
    { value: 'crawspace', label: 'Crawspace' }
  ];

  // Ya no necesitamos handleHeightSelection porque formControlName maneja automáticamente la selección
  // Pero lo mantenemos para limpiar el valor custom cuando se selecciona una opción no-custom
  protected handleHeightSelection(field: 'ceilingHeight' | 'wallCabinetHeight' | 'stackers', value: string): void {
    if (value !== 'custom') {
      const customField = `${field}Custom` as 'ceilingHeightCustom' | 'wallCabinetHeightCustom' | 'stackersCustom';
      const customControl = this.form.controls[customField] as FormControl<number | null>;
      customControl.setValue(null);
    }
  }

  protected isCustomHeightSelected(field: 'ceilingHeight' | 'wallCabinetHeight' | 'stackers'): boolean {
    return this.form.controls[field].value === 'custom';
  }

  protected getCustomHeightValue(field: 'ceilingHeight' | 'wallCabinetHeight' | 'stackers'): number | null {
    return this.form.controls[`${field}Custom` as keyof KitchenQuoteFormGroup['controls']].value as number | null;
  }

  protected handleBooleanRadioChange(field: 'isCabinetsToCelling' | 'dumpsterOnSite' | 'recessedBeam' | 'supportBasement' | 'supportSlab' | 'engineeringReport' | 'demoElectricWiring' | 'runNewDrainSupply' | 'installNewFridgeWaterBox' | 'relocateDishwasher' | 'plaster' | 'backsplashPrep' | 'drywallRepairsCeilingWalls' | 'applianceCooktop' | 'applianceDishwasher', value: boolean): void {
    // Los controles booleanos aceptan boolean | null
    // Usar el control directamente desde controls para mantener el tipado
    const control = this.form.controls[field] as FormControl<boolean | null>;
    control.setValue(value);
  }

  protected selectLocationKitchen(location: string): void {
    const control = this.form.controls['locationKitchen'] as FormControl<string[]>;
    const current = (control.value ?? []) as string[];
    const index = current.indexOf(location);
    if (index > -1) {
      control.setValue(current.filter((l: string) => l !== location));
    } else {
      control.setValue([...current, location]);
    }
  }

  protected isLocationSelected(location: string): boolean {
    const control = this.form.controls['locationKitchen'] as FormControl<string[]>;
    const current = (control.value ?? []) as string[];
    return current.includes(location);
  }

  protected selectSubFloor(subfloor: string): void {
    const control = this.form.controls['subFloor'] as FormControl<string[]>;
    const current = (control.value ?? []) as string[];
    const index = current.indexOf(subfloor);
    if (index > -1) {
      control.setValue(current.filter((s: string) => s !== subfloor));
    } else {
      control.setValue([...current, subfloor]);
    }
  }

  protected isSubfloorSelected(subfloor: string): boolean {
    const control = this.form.controls['subFloor'] as FormControl<string[]>;
    const current = (control.value ?? []) as string[];
    return current.includes(subfloor);
  }

  protected selectWoodHoodVentSize(size: string): void {
    const control = this.form.controls['woodHoodVentSize'] as FormControl<string | null>;
    control.setValue(size);
  }

  protected isSinkSelected(sink: string): boolean {
    const control = this.form.controls['sinkSelection'] as FormControl<string[] | null>;
    const current = (control.value ?? []) as string[];
    return Array.isArray(current) && current.includes(sink);
  }

  protected selectSink(sink: string): void {
    const control = this.form.controls['sinkSelection'] as FormControl<string[] | null>;
    const current = (control.value ?? []) as string[];
    if (!Array.isArray(current) || current.length === 0) {
      control.setValue([sink]);
      return;
    }
    const index = current.indexOf(sink);
    if (index > -1) {
      // Si ya está seleccionado, removerlo (toggle)
      const newValue = current.filter((s: string) => s !== sink);
      control.setValue(newValue);
    } else {
      // Si no está seleccionado, agregarlo (máximo 2)
      if (current.length < 2) {
        const newValue: string[] = [...current, sink];
        control.setValue(newValue);
      }
    }
  }

  protected getSelectedKitchenTypeLabel(): string {
    const map: Record<string, string> = {
      basic: 'Basic Kitchen',
      premium: 'Premium Kitchen',
      luxury: 'Luxury Kitchen'
    };
    return map[this.selectedKitchenType] ?? 'Kitchen';
  }

  protected setControlValue(controlName: string, value: string | null): void {
    const control = this.form.controls[controlName] as FormControl<unknown>;
    control.setValue(value);
  }

  protected getControlValue(controlName: string): unknown {
    const control = this.form.controls[controlName] as FormControl<unknown>;
    return control.value;
  }

  protected getControlValueAsString(controlName: string): string | null {
    const control = this.form.controls[controlName] as FormControl<unknown>;
    const value = control.value;
    return typeof value === 'string' ? value : null;
  }

  protected isControlValueEqual(controlName: string, compareValue: string | boolean): boolean {
    const control = this.form.controls[controlName] as FormControl<unknown>;
    return control.value === compareValue;
  }

  ngOnInit(): void {
    // Los computed signals se actualizan automáticamente cuando cambian los valores del formulario
    // No necesitamos suscripciones adicionales ya que los computed signals son reactivos

    // Configurar habilitación/deshabilitación de buildNewWall basado en frameNewWall
    const frameNewWallControl = this.form.controls['frameNewWall'] as FormControl<string | null>;
    frameNewWallControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        const buildNewWallControl = this.form.controls['buildNewWall'] as FormControl<unknown>;
        if (value === 'yes') {
          buildNewWallControl.enable();
        } else {
          buildNewWallControl.disable();
        }
      });

    // Configurar habilitación/deshabilitación de relocateWallQuantity basado en relocateWall
    const relocateWallControl = this.form.controls['relocateWall'] as FormControl<string | null>;
    relocateWallControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(value => {
        const relocateWallQuantityControl = this.form.controls['relocateWallQuantity'] as FormControl<unknown>;
        if (value === 'yes') {
          relocateWallQuantityControl.enable();
        } else {
          relocateWallQuantityControl.disable();
        }
      });

    // Aplicar estado inicial
    if (frameNewWallControl.value !== 'yes') {
      const buildNewWallControl = this.form.controls['buildNewWall'] as FormControl<unknown>;
      buildNewWallControl.disable();
    }
    if (relocateWallControl.value !== 'yes') {
      const relocateWallQuantityControl = this.form.controls['relocateWallQuantity'] as FormControl<unknown>;
      relocateWallQuantityControl.disable();
    }
  }
}

