declare namespace google {
  namespace maps {
    interface PlacesLibrary {
      PlaceAutocompleteElement: typeof PlaceAutocompleteElement;
    }

    function importLibrary(libraryName: 'places'): Promise<PlacesLibrary>;

    class Geocoder {
      geocode(
        request: GeocoderRequest,
        callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
      ): void;
    }

    interface GeocoderRequest {
      address?: string;
      location?: { lat: number; lng: number };
      componentRestrictions?: { country?: string | string[] };
    }

    interface GeocoderResult {
      address_components?: GeocoderAddressComponent[];
      formatted_address?: string;
      geometry?: {
        location: { lat: number; lng: number };
      };
    }

    interface GeocoderAddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }

    type GeocoderStatus = 'OK' | 'ZERO_RESULTS' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'INVALID_REQUEST' | 'UNKNOWN_ERROR';

    namespace places {
      interface PlaceAutocompleteElementOptions {
        locationRestriction?: {
          north: number;
          south: number;
          east: number;
          west: number;
        };
        componentRestrictions?: {
          country?: string | string[];
        };
      }

      class PlaceAutocompleteElement extends HTMLElement {
        constructor(options?: PlaceAutocompleteElementOptions);
        value: string;
        addEventListener(
          type: 'gmp-select',
          listener: (event: PlaceAutocompleteSelectEvent) => void
        ): void;
        addEventListener(
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          options?: boolean | AddEventListenerOptions
        ): void;
        removeEventListener(
          type: 'gmp-select',
          listener: (event: PlaceAutocompleteSelectEvent) => void
        ): void;
        removeEventListener(
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          options?: boolean | EventListenerOptions
        ): void;
      }

      interface PlaceAutocompleteSelectEvent extends Event {
        placePrediction: PlacePrediction;
      }

      interface PlacePrediction {
        toPlace(): Place;
      }

      interface Place {
        fetchFields(options: { fields: string[] }): Promise<void>;
        displayName?: string;
        formattedAddress?: string;
        addressComponents?: AddressComponent[];
        location?: { lat: number; lng: number };
      }

      interface AddressComponent {
        longText?: string;
        shortText?: string;
        types: string[];
        languageCode?: string;
      }

      // Mantener compatibilidad con la API antigua si es necesario
      interface AutocompleteOptions {
        componentRestrictions?: { country: string | string[] };
        fields?: string[];
        types?: string[];
      }

      class Autocomplete {
        constructor(inputField: HTMLInputElement, opts?: AutocompleteOptions);
        getPlace(): PlaceResult;
        addListener(eventName: string, handler: () => void): void;
      }

      interface PlaceResult {
        address_components?: AddressComponent[];
        formatted_address?: string;
      }
    }
  }
}

