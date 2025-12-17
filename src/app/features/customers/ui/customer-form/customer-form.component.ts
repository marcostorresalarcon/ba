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
import { textOnlyValidator, usPhoneValidator, emailFormatValidator, numbersOnlyValidator } from '../../../../core/validators/custom.validators';
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
  private placeChangedHandler?: (event: google.maps.places.PlaceAutocompleteSelectEvent) => void;
  private inputElement: HTMLInputElement | null = null;
  private inputObserver: MutationObserver | null = null;
  private elementObserver: MutationObserver | null = null;

  @ViewChild('addressContainer', { static: false }) addressContainerRef?: ElementRef<HTMLDivElement>;

  protected readonly form: CustomerFormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, textOnlyValidator()]],
    lastName: ['', [Validators.required, textOnlyValidator()]],
    phone: ['', [usPhoneValidator()]],
    date: [''],
    email: ['', [emailFormatValidator()]],
    address: [''],
    city: [''],
    zipCode: ['', [numbersOnlyValidator()]],
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
        // Formatear el teléfono si existe
        const formattedPhone = value.phone ? this.formatPhoneNumber(value.phone) : '';
        
        this.form.patchValue({
          name: value.name,
          lastName: value.lastName,
          phone: formattedPhone,
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
    // Limpiar observers
    if (this.inputObserver) {
      this.inputObserver.disconnect();
      this.inputObserver = null;
    }
    if (this.elementObserver) {
      this.elementObserver.disconnect();
      this.elementObserver = null;
    }

    if (this.autocompleteElement && this.placeChangedHandler) {
      this.autocompleteElement.removeEventListener('gmp-select', this.placeChangedHandler);
      this.placeChangedHandler = undefined;
    }
    if (this.autocompleteElement?.parentNode) {
      const element = this.autocompleteElement as Node;
      this.autocompleteElement.parentNode.removeChild(element);
    }
    this.autocompleteElement = null;
    this.inputElement = null;
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

      // Configurar el handler para el evento gmp-select
      // Este es el evento oficial que se dispara cuando el usuario selecciona una dirección
      this.placeChangedHandler = async (event: any) => {
        // El evento gmp-select proporciona placePrediction que debe convertirse a Place
        const placePrediction = event.placePrediction;
        if (!placePrediction) {
          return;
        }

        try {
          // Convertir placePrediction a Place
          const place = placePrediction.toPlace();

          // Obtener los campos necesarios
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'addressComponents']
          });

          // Este es el método principal que extrae y completa los campos
          await this.handlePlaceSelect(place);
        } catch (error) {
          // Error processing place
        }
      };

      // Agregar el listener usando el evento oficial gmp-select
      try {
        this.autocompleteElement.addEventListener('gmp-select', this.placeChangedHandler);
      } catch (error) {
        // Error adding event listener
      }

      // Esperar a que el elemento se renderice completamente y encontrar el input
      // El PlaceAutocompleteElement puede tener un shadow DOM, así que necesitamos buscar en diferentes lugares
      const findAndSetupInput = async (retries = 20): Promise<void> => {
        for (let i = 0; i < retries; i++) {
          await new Promise(resolve => setTimeout(resolve, 150));

          // Buscar el input en diferentes lugares
          let inputElement: HTMLInputElement | null = null;

          // 1. Buscar directamente en el elemento
          inputElement = this.autocompleteElement?.querySelector('input') || null;

          // 2. Si no se encuentra, buscar en shadow DOM
          if (!inputElement && this.autocompleteElement?.shadowRoot) {
            inputElement = this.autocompleteElement.shadowRoot.querySelector('input');
          }

          // 3. Buscar en cualquier lugar dentro del elemento
          if (!inputElement) {
            const allInputs = this.autocompleteElement?.querySelectorAll('input');
            if (allInputs && allInputs.length > 0) {
              inputElement = allInputs[0] as HTMLInputElement;
            }
          }

          if (inputElement) {
            let lastValue = '';
            let blurTimeout: ReturnType<typeof setTimeout> | null = null;

            // Escuchar cambios en el input
            inputElement.addEventListener('input', () => {
              const currentValue = this.autocompleteElement?.value || '';
              if (currentValue !== lastValue) {
                lastValue = currentValue;
              }
            });

            // Escuchar cuando el usuario presiona Enter
            inputElement.addEventListener('keydown', async (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setTimeout(async () => {
                  const currentValue = this.autocompleteElement?.value;
                  if (currentValue && currentValue.length > 5) {
                    await this.handleAddressSelection(currentValue);
                  }
                }, 500);
              }
            });

            // Escuchar cuando se pierde el foco (blur) - esto se dispara cuando se selecciona una opción
            inputElement.addEventListener('blur', async () => {
              // Limpiar timeout anterior si existe
              if (blurTimeout) {
                clearTimeout(blurTimeout);
              }

              // Esperar un poco más para que el PlaceAutocompleteElement actualice su valor
              blurTimeout = setTimeout(async () => {
                const currentValue = this.autocompleteElement?.value || inputElement.value;
                const formValue = this.form.controls.address.value;

                if (currentValue && currentValue !== formValue && currentValue.length > 5) {
                  await this.handleAddressSelection(currentValue);
                }
              }, 800);
            });

            // Escuchar el evento 'change' del input
            // Este evento se dispara cuando el valor del input cambia y pierde el foco
            inputElement.addEventListener('change', async () => {
              const currentValue = this.autocompleteElement?.value || inputElement.value;

              // Solo procesar si es una dirección completa y no ha sido procesada
              if (currentValue &&
                currentValue.length > 10 &&
                (this.form.controls.city.value === '' ||
                  this.form.controls.state.value === '' ||
                  this.form.controls.zipCode.value === '')) {
                // Esperar un poco para que el evento gmp-select se dispare primero
                setTimeout(async () => {
                  if (this.form.controls.city.value === '' ||
                    this.form.controls.state.value === '' ||
                    this.form.controls.zipCode.value === '') {
                    await this.handleAddressSelection(currentValue);
                  }
                }, 1000);
              }
            });

            // Observar cambios en el atributo 'value' del PlaceAutocompleteElement
            // Esto detecta cuando se actualiza el valor después de seleccionar una dirección
            if (this.autocompleteElement) {
              this.elementObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                  if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                    const newValue = this.autocompleteElement?.getAttribute('value') || '';

                    if (newValue && newValue.length > 10) {
                      // Esperar un poco para que el evento gmp-select se dispare primero
                      setTimeout(async () => {
                        // Si el evento no procesó la dirección, usar Geocoding API como fallback
                        if (this.form.controls.city.value === '' &&
                          this.form.controls.state.value === '' &&
                          this.form.controls.zipCode.value === '') {
                          await this.handleAddressSelection(newValue);
                        }
                      }, 1000);
                    }
                  }
                });
              });

              this.elementObserver.observe(this.autocompleteElement as Node, {
                attributes: true,
                attributeFilter: ['value']
              });
            }

            // Observar cambios en el valor del input interno
            // Esto detecta cuando el usuario escribe o selecciona una dirección
            this.inputObserver = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                  const inputValue = inputElement.value;

                  // Solo procesar si es una dirección completa (más de 10 caracteres)
                  // y no ha sido procesada aún
                  if (inputValue && inputValue.length > 10 &&
                    this.form.controls.address.value !== inputValue) {
                    // Esperar para que el evento gmp-select se dispare primero
                    setTimeout(async () => {
                      if (this.form.controls.city.value === '' &&
                        this.form.controls.state.value === '' &&
                        this.form.controls.zipCode.value === '') {
                        await this.handleAddressSelection(inputValue);
                      }
                    }, 1000);
                  }
                }
              });
            });

            this.inputObserver.observe(inputElement, {
              attributes: true,
              attributeFilter: ['value']
            });

            // Configurar MutationObserver para detectar cuando se agregan sugerencias al dropdown
            // Esto es más eficiente que usar setInterval
            if (this.autocompleteElement?.shadowRoot) {
              const shadowRoot = this.autocompleteElement.shadowRoot;
              const dropdownObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                  if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Se agregaron nodos, pueden ser sugerencias
                    const suggestions = shadowRoot.querySelectorAll('[role="option"], .pac-item, [data-place-id]');
                    if (suggestions && suggestions.length > 0) {
                      suggestions.forEach((suggestion) => {
                        if (!(suggestion as HTMLElement).hasAttribute('data-listener-added')) {
                          (suggestion as HTMLElement).setAttribute('data-listener-added', 'true');
                          suggestion.addEventListener('click', async () => {
                            // Esperar a que el evento gmp-select se dispare primero
                            setTimeout(async () => {
                              // Si el evento no se disparó, procesar manualmente
                              if (this.form.controls.city.value === '' &&
                                this.form.controls.state.value === '' &&
                                this.form.controls.zipCode.value === '') {
                                const currentValue = this.autocompleteElement?.value || inputElement.value;
                                if (currentValue && currentValue.length > 10) {
                                  await this.handleAddressSelection(currentValue);
                                }
                              }
                            }, 1000);
                          });
                        }
                      });
                    }
                  }
                });
              });

              dropdownObserver.observe(shadowRoot, {
                childList: true,
                subtree: true
              });
            }

            return;
          }
        }
      };

      // Intentar encontrar y configurar el input
      await findAndSetupInput();

      // Sincronizar el valor del formulario con el elemento
      this.syncFormValue();
    } catch (error) {
      // Error initializing Google Maps autocomplete
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
   * Intenta obtener el place directamente del PlaceAutocompleteElement
   */
  private async tryGetPlaceFromElement(): Promise<void> {
    if (!this.autocompleteElement) {
      return;
    }

    try {
      // Intentar diferentes métodos para obtener el place
      const methods = ['getPlace', 'place', 'selectedPlace', '_place'];

      for (const method of methods) {
        if ((this.autocompleteElement as any)[method]) {
          try {
            const place = typeof (this.autocompleteElement as any)[method] === 'function'
              ? (this.autocompleteElement as any)[method]()
              : (this.autocompleteElement as any)[method];

            if (place) {
              await this.handlePlaceSelect(place);
              return;
            }
          } catch (error) {
            // Error calling method
          }
        }
      }
    } catch (error) {
      // Error in tryGetPlaceFromElement
    }
  }

  /**
   * Maneja la selección de dirección cuando se proporciona el texto de la dirección
   */
  private async handleAddressSelection(addressText: string): Promise<void> {
    if (!addressText || !window.google?.maps) {
      return;
    }

    // Primero intentar obtener el place directamente del elemento
    await this.tryGetPlaceFromElement();

    // Si no funcionó, usar Geocoding API como fallback
    try {
      // Usar Geocoding API para obtener los detalles de la dirección
      const geocoder = new window.google.maps.Geocoder();

      const request: google.maps.GeocoderRequest = {
        address: addressText,
        componentRestrictions: { country: 'us' }
      };

      geocoder.geocode(request, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const result = results[0];
          this.extractAddressComponents(result);
        }
      });
    } catch (error) {
      // Error in handleAddressSelection
    }
  }

  /**
   * Extrae los componentes de dirección de un resultado de Geocoding API
   * Este método se usa como fallback cuando PlaceAutocompleteElement no proporciona los componentes
   * Según la documentación oficial de Geocoding API:
   * - address_components: Array de componentes con long_name, short_name, types
   * - formatted_address: Dirección completa formateada
   */
  private extractAddressComponents(geocodeResult: google.maps.GeocoderResult): void {
    const addressComponents = geocodeResult.address_components || [];

    let city = '';
    let state = '';
    let zipCode = '';
    let fullAddress = geocodeResult.formatted_address || '';

    for (const component of addressComponents) {
      const types = component.types || [];
      const longName = component.long_name || '';
      const shortName = component.short_name || '';

      // CIUDAD (City):
      // Según la API oficial de Geocoding, la ciudad puede venir en:
      // - 'locality': Ciudad principal
      // - 'sublocality': Sub-localidad (barrio, distrito)
      // - 'administrative_area_level_2': Condado (a veces usado como ciudad)
      // Prioridad: locality > sublocality > administrative_area_level_2
      if (!city) {
        if (types.includes('locality')) {
          city = longName;
        } else if (types.includes('sublocality')) {
          city = longName;
        } else if (types.includes('administrative_area_level_2') && !city) {
          city = longName;
        }
      }

      // ESTADO (State):
      // Según la API oficial de Geocoding, el estado viene en:
      // - 'administrative_area_level_1': Estado o provincia
      // Usar short_name para el código de estado (ej: "CA", "NY", "FL")
      // Si no hay short_name, usar long_name como fallback
      if (types.includes('administrative_area_level_1')) {
        // Preferir short_name (código de estado) pero usar long_name si no está disponible
        state = shortName || longName;
      }

      // CÓDIGO POSTAL (Zip Code):
      // Según la API oficial de Geocoding, el código postal viene en:
      // - 'postal_code': Código postal
      // Usar long_name (puede incluir el código postal extendido)
      if (types.includes('postal_code')) {
        zipCode = longName || shortName;
      }
    }

    // Preparar actualizaciones del formulario
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

    // Aplicar todos los cambios de una vez
    this.form.patchValue(updates);

    // Forzar detección de cambios ya que usamos OnPush
    this.cdr.markForCheck();
  }

  /**
   * Maneja la selección de una dirección del autocompletado
   * Según la documentación oficial de Google Maps Places API:
   * - formattedAddress: Dirección completa formateada
   * - addressComponents: Array de componentes de dirección
   * - Cada componente tiene: longText (nombre completo), shortText (código corto), types (array de tipos)
   * - Tipos importantes: 'locality' (ciudad), 'administrative_area_level_1' (estado), 'postal_code' (código postal)
   */
  private async handlePlaceSelect(place: google.maps.places.Place): Promise<void> {
    if (!place) {
      return;
    }

    try {
      // Según la API oficial, debemos usar fetchFields para obtener los datos completos
      // Los campos disponibles según la documentación oficial:
      // - formattedAddress: Dirección completa
      // - addressComponents: Componentes de la dirección (ciudad, estado, código postal, etc.)
      // - displayName: Nombre del lugar
      await place.fetchFields({
        fields: [
          'formattedAddress',
          'addressComponents',
          'displayName'
        ]
      });

      // Establecer la dirección completa
      const formattedAddress = place.formattedAddress || place.displayName || '';

      // Extraer componentes de la dirección según la API oficial
      let city = '';
      let state = '';
      let zipCode = '';

      if (place.addressComponents && place.addressComponents.length > 0) {
        for (let i = 0; i < place.addressComponents.length; i++) {
          const component = place.addressComponents[i];
          const types = component.types || [];

          // Según la API oficial, los componentes tienen:
          // - longText: Nombre completo (ej: "California", "New York")
          // - shortText: Código corto (ej: "CA", "NY")
          const longText = component.longText || '';
          const shortText = component.shortText || '';

          // CIUDAD (City):
          // Según la API oficial, la ciudad puede venir en varios tipos:
          // - 'locality': Ciudad principal
          // - 'sublocality': Sub-localidad (barrio, distrito)
          // - 'sublocality_level_1': Nivel 1 de sub-localidad
          // - 'administrative_area_level_2': Condado (a veces usado como ciudad)
          // Prioridad: locality > sublocality > sublocality_level_1 > administrative_area_level_2
          if (!city) {
            if (types.includes('locality')) {
              city = longText;
            } else if (types.includes('sublocality')) {
              city = longText;
            } else if (types.includes('sublocality_level_1')) {
              city = longText;
            } else if (types.includes('administrative_area_level_2') && !city) {
              city = longText;
            }
          }

          // ESTADO (State):
          // Según la API oficial, el estado viene en:
          // - 'administrative_area_level_1': Estado o provincia
          // Usar shortText para el código de estado (ej: "CA", "NY", "FL")
          // Si no hay shortText, usar longText como fallback
          if (types.includes('administrative_area_level_1')) {
            // Preferir shortText (código de estado) pero usar longText si no está disponible
            state = shortText || longText;
          }

          // CÓDIGO POSTAL (Zip Code):
          // Según la API oficial, el código postal viene en:
          // - 'postal_code': Código postal
          // Usar longText (puede incluir el código postal extendido)
          if (types.includes('postal_code')) {
            zipCode = longText || shortText;
          }
        }
      }

      // Preparar actualizaciones del formulario
      const updates: Partial<CustomerFormGroup['value']> = {
        address: formattedAddress
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

      // Aplicar todos los cambios de una vez
      this.form.patchValue(updates);

      // Forzar detección de cambios ya que usamos OnPush
      this.cdr.markForCheck();
    } catch (error) {
      // Intentar usar Geocoding API como fallback
      if (place.formattedAddress || place.displayName) {
        const addressText = place.formattedAddress || place.displayName || '';
        await this.handleAddressSelection(addressText);
      }
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

    const formValue = this.form.getRawValue();
    
    // Agregar prefijo +1 al teléfono si tiene valor
    const phoneWithPrefix = formValue.phone 
      ? `+1${formValue.phone.replace(/\D/g, '')}` 
      : '';
    
    const payload: CustomerFormValue = {
      ...formValue,
      phone: phoneWithPrefix
    };
    
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

    if (control.errors['numbersOnly']) {
      return 'Only numbers are allowed';
    }

    return 'Invalid value';
  }

  /**
   * Restringe la entrada a solo letras (incluyendo espacios, guiones y apóstrofes)
   * Para campos de nombre y apellido
   */
  protected onTextInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    // Permitir letras (incluyendo acentos), espacios, guiones y apóstrofes
    const textOnlyRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]*$/;

    if (!textOnlyRegex.test(value)) {
      // Remover caracteres no permitidos
      input.value = value.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]/g, '');
      // Actualizar el control del formulario
      const controlName = input.getAttribute('formControlName');
      if (controlName) {
        this.form.controls[controlName as keyof CustomerFormGroup['controls']].setValue(input.value, { emitEvent: false });
      }
    }
  }

  /**
   * Formatea un número de teléfono al formato (999) 999-9999
   * @param phoneNumber - Número de teléfono sin formato o con formato
   * @returns Número formateado como (999) 999-9999
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remover todos los caracteres no numéricos
    const numbersOnly = phoneNumber.replace(/\D/g, '');
    
    // Si tiene el código de país +1, removerlo
    const cleaned = numbersOnly.startsWith('1') && numbersOnly.length === 11 
      ? numbersOnly.slice(1) 
      : numbersOnly;
    
    // Limitar a 10 dígitos
    const limitedNumbers = cleaned.slice(0, 10);
    
    // Formatear como (999) 999-9999
    if (limitedNumbers.length === 0) {
      return '';
    } else if (limitedNumbers.length <= 3) {
      return `(${limitedNumbers}`;
    } else if (limitedNumbers.length <= 6) {
      return `(${limitedNumbers.slice(0, 3)}) ${limitedNumbers.slice(3)}`;
    } else {
      return `(${limitedNumbers.slice(0, 3)}) ${limitedNumbers.slice(3, 6)}-${limitedNumbers.slice(6)}`;
    }
  }

  /**
   * Restringe la entrada a solo números y formatea automáticamente como (999) 999-9999
   * Para campos de teléfono de Estados Unidos (+1)
   */
  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    // Remover todos los caracteres no numéricos
    const numbersOnly = value.replace(/\D/g, '');
    
    // Limitar a 10 dígitos (formato US sin código de país)
    const limitedNumbers = numbersOnly.slice(0, 10);
    
    // Formatear como (999) 999-9999
    const formatted = this.formatPhoneNumber(limitedNumbers);
    
    // Actualizar el valor del input
    input.value = formatted;
    
    // Actualizar el control del formulario
    this.form.controls.phone.setValue(formatted, { emitEvent: false });
  }

  /**
   * Restringe la entrada a solo números
   * Para campos de código postal
   */
  protected onNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    // Solo números
    const numbersOnlyRegex = /^\d*$/;

    if (!numbersOnlyRegex.test(value)) {
      // Remover caracteres no permitidos
      input.value = value.replace(/\D/g, '');
      // Actualizar el control del formulario
      this.form.controls.zipCode.setValue(input.value, { emitEvent: false });
    }
  }
}


