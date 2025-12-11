import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import type { OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FormControl, FormGroup } from '@angular/forms';

import type { Customer, CustomerPayload } from '../../../../core/models/customer.model';
import { textOnlyValidator, usPhoneValidator, emailFormatValidator } from '../../../../core/validators/custom.validators';
import { GoogleMapsService } from '../../../../core/services/maps/google-maps.service';

export type CustomerFormValue = Omit<CustomerPayload, 'companyId'>;

type CustomerFormGroup = FormGroup<{
  name: FormControl<string>;
  lastName: FormControl<string>;
  phone: FormControl<string>;
  date: FormControl<string>;
  email: FormControl<string>;
  address: FormControl<string>;
  city: FormControl<string>;
  zipCode: FormControl<string>;
  state: FormControl<string>;
  leadSource: FormControl<string>;
  description: FormControl<string>;
}>;

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './customer-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .address-autocomplete-container input {
        border: 1px solid rgb(229, 231, 235) !important;
        border-radius: 1rem !important;
        background-color: white !important;
        padding: 0.75rem 1rem !important;
        width: 100% !important;
        font-size: 1rem !important;
        color: rgb(51, 47, 40) !important;
        outline: none !important;
      }
      
      :host ::ng-deep .address-autocomplete-container input:focus {
        border-color: rgb(58, 115, 68) !important;
      }
      
      :host ::ng-deep .address-autocomplete-container input::placeholder {
        color: rgb(148, 163, 184) !important;
      }
    `
  ]
})
export class CustomerFormComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly googleMapsService = inject(GoogleMapsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private autocompleteElement: google.maps.places.PlaceAutocompleteElement | null = null;
  private initRetryCount = 0;
  private readonly maxInitRetries = 10;
  private placeChangedHandler?: (event: google.maps.places.PlaceAutocompletePlaceChangedEvent) => void;

  @ViewChild('addressContainer', { static: false }) addressContainerRef?: ElementRef<HTMLDivElement>;

  protected readonly form: CustomerFormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, textOnlyValidator()]],
    lastName: ['', [Validators.required, textOnlyValidator()]],
    phone: ['', [usPhoneValidator()]],
    date: [''],
    email: ['', [emailFormatValidator()]],
    address: [''],
    city: [''],
    zipCode: [''],
    state: [''],
    leadSource: [''],
    description: ['']
  });

  @Input({ required: false }) customer: Customer | null = null;
  @Input({ required: true }) isSubmitting = false;

  @Output() readonly submitCustomer = new EventEmitter<CustomerFormValue>();
  @Output() readonly cancelEdit = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customer']) {
      const value = changes['customer'].currentValue as Customer | null;
      if (value) {
        this.form.patchValue({
          name: value.name,
          lastName: value.lastName,
          phone: value.phone ?? '',
          date: value.date ?? '',
          email: value.email ?? '',
          address: value.address ?? '',
          city: value.city ?? '',
          zipCode: value.zipCode ?? '',
          state: value.state ?? '',
          leadSource: value.leadSource ?? '',
          description: value.description ?? ''
        });
      } else {
        this.form.reset({
          name: '',
          lastName: '',
          phone: '',
          date: '',
          email: '',
          address: '',
          city: '',
          zipCode: '',
          state: '',
          leadSource: '',
          description: ''
        });
      }
    }
  }

  async ngAfterViewInit(): Promise<void> {
    await this.initializeAutocomplete();
  }

  ngOnDestroy(): void {
    if (this.autocompleteElement && this.placeChangedHandler) {
      this.autocompleteElement.removeEventListener('gmp-placechanged', this.placeChangedHandler);
      this.placeChangedHandler = undefined;
    }
    if (this.autocompleteElement?.parentNode) {
      const element = this.autocompleteElement as Node;
      this.autocompleteElement.parentNode.removeChild(element);
    }
    this.autocompleteElement = null;
  }

  /**
   * Inicializa el autocompletado de Google Maps Places usando PlaceAutocompleteElement
   */
  private async initializeAutocomplete(): Promise<void> {
    try {
      // Asegurar que Google Maps API esté cargada
      await this.googleMapsService.ensureGoogleMapsLoaded();
      
      // Importar la biblioteca de Places y obtener PlaceAutocompleteElement
      const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places') as google.maps.PlacesLibrary;

      if (!PlaceAutocompleteElement) {
        throw new Error('PlaceAutocompleteElement is not available');
      }

      // Esperar a que el ViewChild esté disponible
      if (!this.addressContainerRef?.nativeElement) {
        // Si no está disponible, intentar de nuevo después de un breve delay
        if (this.initRetryCount < this.maxInitRetries) {
          this.initRetryCount++;
          setTimeout(() => this.initializeAutocomplete(), 100);
        } else {
          console.warn('Failed to initialize Google Maps autocomplete: container element not found');
        }
        return;
      }

      const container = this.addressContainerRef.nativeElement;

      // Limpiar cualquier elemento previo
      if (this.autocompleteElement?.parentNode) {
        const element = this.autocompleteElement as Node;
        this.autocompleteElement.parentNode.removeChild(element);
      }

      // Configurar restricción a solo EEUU usando ambas opciones para máxima compatibilidad
      const options: google.maps.places.PlaceAutocompleteElementOptions = {
        componentRestrictions: {
          country: 'us'
        },
        // También usar locationRestriction para restringir geográficamente
        locationRestriction: {
          north: 49.3457868,  // Límite norte de EEUU
          south: 24.396308,   // Límite sur de EEUU
          east: -66.93457,    // Límite este de EEUU
          west: -125.0        // Límite oeste de EEUU
        }
      };

      // Crear el elemento de autocompletado
      this.autocompleteElement = new PlaceAutocompleteElement(options);

      if (!this.autocompleteElement) {
        throw new Error('Failed to create PlaceAutocompleteElement');
      }

      // Estilizar el elemento para que coincida con el diseño
      // El PlaceAutocompleteElement renderiza un input internamente
      // Los estilos se aplican mediante CSS en el componente
      this.autocompleteElement.style.width = '100%';
      this.autocompleteElement.style.display = 'block';

      // Agregar al contenedor (usar type assertion para Node)
      container.appendChild(this.autocompleteElement as Node);

      // Configurar el handler para el evento gmp-placechanged PRIMERO
      this.placeChangedHandler = async (event: google.maps.places.PlaceAutocompletePlaceChangedEvent) => {
        console.log('✅ Place changed event fired', event);
        if (event.place) {
          console.log('✅ Place object received:', event.place);
          await this.handlePlaceSelect(event.place);
        } else {
          console.warn('⚠️ Place is null in event');
        }
      };

      // Agregar el listener del evento
      this.autocompleteElement.addEventListener('gmp-placechanged', this.placeChangedHandler);
      
      // Esperar a que el elemento se renderice completamente y encontrar el input
      const findAndSetupInput = async (retries = 10): Promise<void> => {
        for (let i = 0; i < retries; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const inputElement = this.autocompleteElement?.querySelector('input');
          if (inputElement) {
            console.log('✅ Input element found after', (i + 1) * 100, 'ms');
            
            let lastValue = '';
            let blurTimeout: ReturnType<typeof setTimeout> | null = null;
            
            // Escuchar cambios en el input
            inputElement.addEventListener('input', () => {
              const currentValue = this.autocompleteElement?.value || '';
              if (currentValue !== lastValue) {
                lastValue = currentValue;
                console.log('📝 Input value changed:', currentValue);
              }
            });

            // Escuchar cuando el usuario presiona Enter
            inputElement.addEventListener('keydown', async (e) => {
              if (e.key === 'Enter') {
                console.log('⌨️ Enter pressed, waiting for place selection...');
                e.preventDefault();
                setTimeout(async () => {
                  const currentValue = this.autocompleteElement?.value;
                  if (currentValue && currentValue.length > 5) {
                    console.log('🔄 Processing address after Enter:', currentValue);
                    await this.handleAddressSelection(currentValue);
                  }
                }, 500);
              }
            });

            // Escuchar cuando se pierde el foco (blur) - esto se dispara cuando se selecciona una opción
            inputElement.addEventListener('blur', async () => {
              console.log('👋 Input blur event');
              
              // Limpiar timeout anterior si existe
              if (blurTimeout) {
                clearTimeout(blurTimeout);
              }
              
              blurTimeout = setTimeout(async () => {
                const currentValue = this.autocompleteElement?.value;
                const formValue = this.form.controls.address.value;
                console.log('👋 Blur - currentValue:', currentValue, 'formValue:', formValue);
                
                if (currentValue && currentValue !== formValue && currentValue.length > 5) {
                  console.log('🔄 Processing address after blur:', currentValue);
                  await this.handleAddressSelection(currentValue);
                }
              }, 400);
            });

            // También escuchar el evento 'change' del input
            inputElement.addEventListener('change', async () => {
              const currentValue = this.autocompleteElement?.value;
              console.log('🔄 Input change event:', currentValue);
              if (currentValue && currentValue.length > 5) {
                setTimeout(async () => {
                  await this.handleAddressSelection(currentValue);
                }, 300);
              }
            });

            // Observar cambios en el valor del PlaceAutocompleteElement directamente
            if (this.autocompleteElement) {
              const observer = new MutationObserver(() => {
                const currentValue = this.autocompleteElement?.value;
                if (currentValue && currentValue !== this.form.controls.address.value && currentValue.length > 5) {
                  console.log('👀 MutationObserver detected value change:', currentValue);
                  setTimeout(async () => {
                    await this.handleAddressSelection(currentValue);
                  }, 200);
                }
              });

              observer.observe(this.autocompleteElement as Node, {
                attributes: true,
                attributeFilter: ['value'],
                childList: true,
                subtree: true
              });
            }

            console.log('✅ All input listeners and observers set up');
            return;
          }
        }
        
        console.warn('⚠️ Input element not found after', retries * 100, 'ms');
      };

      // Intentar encontrar y configurar el input
      await findAndSetupInput();
      
      console.log('✅ PlaceAutocompleteElement initialized and all event listeners added');

      // Sincronizar el valor del formulario con el elemento
      this.syncFormValue();
    } catch (error) {
      console.error('Error initializing Google Maps autocomplete:', error);
    }
  }

  /**
   * Sincroniza el valor del formulario con el elemento de autocompletado
   */
  private syncFormValue(): void {
    if (!this.autocompleteElement) {
      return;
    }

    // Establecer valor inicial si existe
    const addressValue = this.form.controls.address.value;
    if (addressValue) {
      this.autocompleteElement.value = addressValue;
    }

    // Sincronizar cambios del PlaceAutocompleteElement al formulario
    // El PlaceAutocompleteElement tiene un input interno, escuchamos sus cambios
    const inputElement = this.autocompleteElement.querySelector('input');
    if (inputElement) {
      inputElement.addEventListener('input', () => {
        const currentValue = this.autocompleteElement?.value || '';
        if (this.form.controls.address.value !== currentValue) {
          this.form.controls.address.setValue(currentValue, { emitEvent: false });
        }
      });
    }

    // Sincronizar cambios del formulario al elemento (cuando se edita desde fuera)
    this.form.controls.address.valueChanges.subscribe((value) => {
      if (this.autocompleteElement && value !== this.autocompleteElement.value) {
        this.autocompleteElement.value = value || '';
      }
    });
  }

  /**
   * Maneja la selección de dirección cuando se proporciona el texto de la dirección
   */
  private async handleAddressSelection(addressText: string): Promise<void> {
    if (!addressText || !window.google?.maps) {
      console.warn('⚠️ handleAddressSelection: Missing addressText or Google Maps');
      return;
    }

    console.log('🔄 handleAddressSelection called with:', addressText);

    try {
      // Usar Geocoding API para obtener los detalles de la dirección
      const geocoder = new window.google.maps.Geocoder();
      
      const request: google.maps.GeocoderRequest = {
        address: addressText,
        componentRestrictions: { country: 'us' }
      };

      console.log('🔄 Geocoding request:', request);

      geocoder.geocode(request, (results, status) => {
        console.log('📍 Geocoding response - Status:', status, 'Results:', results);
        
        if (status === 'OK' && results && results.length > 0) {
          const result = results[0];
          console.log('✅ Geocoding successful, extracting components from:', result);
          this.extractAddressComponents(result);
        } else {
          console.warn('⚠️ Geocoding failed or no results. Status:', status);
        }
      });
    } catch (error) {
      console.error('❌ Error in handleAddressSelection:', error);
    }
  }

  /**
   * Extrae los componentes de dirección de un resultado de Geocoding
   */
  private extractAddressComponents(geocodeResult: google.maps.GeocoderResult): void {
    console.log('🔍 extractAddressComponents called with:', geocodeResult);
    
    const addressComponents = geocodeResult.address_components || [];
    console.log('📍 Address components:', addressComponents);
    
    let city = '';
    let state = '';
    let zipCode = '';
    let fullAddress = geocodeResult.formatted_address || '';

    for (const component of addressComponents) {
      const types = component.types || [];
      console.log('  Component:', component.long_name, 'Types:', types);

      // Ciudad
      if (types.includes('locality') && !city) {
        city = component.long_name || '';
        console.log('  ✅ Found city (locality):', city);
      } else if (types.includes('sublocality') && !city) {
        city = component.long_name || '';
        console.log('  ✅ Found city (sublocality):', city);
      } else if (types.includes('administrative_area_level_2') && !city) {
        city = component.long_name || '';
        console.log('  ✅ Found city (administrative_area_level_2):', city);
      }

      // Estado
      if (types.includes('administrative_area_level_1')) {
        state = component.short_name || component.long_name || '';
        console.log('  ✅ Found state:', state);
      }

      // Código postal
      if (types.includes('postal_code')) {
        zipCode = component.long_name || '';
        console.log('  ✅ Found zipCode:', zipCode);
      }
    }

    // Actualizar el formulario
    const updates: Partial<CustomerFormGroup['value']> = {
      address: fullAddress
    };

    if (city) {
      updates.city = city;
    }
    if (state) {
      updates.state = state;
    }
    if (zipCode) {
      updates.zipCode = zipCode;
    }

    console.log('📝 Updating form with:', updates);
    console.log('📝 Current form values before update:', {
      address: this.form.controls.address.value,
      city: this.form.controls.city.value,
      state: this.form.controls.state.value,
      zipCode: this.form.controls.zipCode.value
    });

    this.form.patchValue(updates);
    this.cdr.markForCheck();
    
    console.log('✅ Form updated. New values:', {
      address: this.form.controls.address.value,
      city: this.form.controls.city.value,
      state: this.form.controls.state.value,
      zipCode: this.form.controls.zipCode.value
    });
  }

  /**
   * Maneja la selección de una dirección del autocompletado
   */
  private async handlePlaceSelect(place: google.maps.places.Place): Promise<void> {
    if (!place) {
      console.warn('Place is null or undefined');
      return;
    }

    try {
      console.log('Processing place selection:', place);

      // Obtener los campos necesarios - usar los campos correctos de la nueva API
      await place.fetchFields({
        fields: [
          'formattedAddress',
          'addressComponents',
          'name',
          'displayName'
        ]
      });

      console.log('Place after fetchFields:', place);
      console.log('Address components:', place.addressComponents);

      // Establecer la dirección completa
      const formattedAddress = place.formattedAddress || place.displayName || '';
      this.form.patchValue({
        address: formattedAddress
      });

      // Extraer componentes de la dirección
      let city = '';
      let state = '';
      let zipCode = '';

      if (place.addressComponents && place.addressComponents.length > 0) {
        console.log('Processing address components:', place.addressComponents);
        
        for (const component of place.addressComponents) {
          const types = component.types || [];
          console.log('Component:', component, 'Types:', types);

          // Obtener valores - intentar con ambos formatos (nueva API y antigua)
          const longValue = (component as any).longText || (component as any).long_name || '';
          const shortValue = (component as any).shortText || (component as any).short_name || '';

          // Ciudad - puede ser 'locality' o 'sublocality'
          if (types.includes('locality') && !city) {
            city = longValue;
            console.log('Found city (locality):', city);
          } else if (types.includes('sublocality') && !city) {
            city = longValue;
            console.log('Found city (sublocality):', city);
          } else if (types.includes('sublocality_level_1') && !city) {
            city = longValue;
            console.log('Found city (sublocality_level_1):', city);
          }

          // Estado - administrative_area_level_1 (usar código corto)
          if (types.includes('administrative_area_level_1')) {
            state = shortValue || longValue;
            console.log('Found state:', state);
          }

          // Código postal
          if (types.includes('postal_code')) {
            zipCode = longValue || shortValue;
            console.log('Found zipCode:', zipCode);
          }
        }
      } else {
        console.warn('No address components found');
      }

      // Actualizar los campos del formulario con los valores extraídos
      const updates: Partial<CustomerFormGroup['value']> = {};
      
      if (city) {
        updates.city = city;
      }
      
      if (state) {
        updates.state = state;
      }
      
      if (zipCode) {
        updates.zipCode = zipCode;
      }

      console.log('Updating form with:', updates);

      // Aplicar todos los cambios de una vez
      if (Object.keys(updates).length > 0) {
        this.form.patchValue(updates);
        // Forzar detección de cambios ya que usamos OnPush
        this.cdr.markForCheck();
        console.log('Form updated successfully');
      } else {
        console.warn('No updates to apply - city, state, or zipCode not found');
      }
    } catch (error) {
      console.error('Error processing place selection:', error);
    }
  }

  protected submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();
    this.submitCustomer.emit(payload);
  }

  /**
   * Verifica si un control tiene errores y ha sido tocado
   */
  protected hasError(controlName: keyof CustomerFormGroup['controls']): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  /**
   * Obtiene el mensaje de error para un control
   */
  protected getErrorMessage(controlName: keyof CustomerFormGroup['controls']): string {
    const control = this.form.controls[controlName];
    
    if (!control.errors || !this.hasError(controlName)) {
      return '';
    }

    if (control.errors['required']) {
      return 'This field is required';
    }

    if (control.errors['textOnly']) {
      return 'Only letters, spaces, hyphens, and apostrophes are allowed';
    }

    if (control.errors['usPhone']) {
      return 'Please enter a valid US phone number (e.g., (123) 456-7890)';
    }

    if (control.errors['emailFormat']) {
      return 'Please enter a valid email address';
    }

    return 'Invalid value';
  }
}


