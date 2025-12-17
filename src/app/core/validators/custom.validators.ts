import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador para campos de texto que solo permiten letras, espacios, acentos, guiones y apóstrofes
 * Útil para nombres y apellidos
 */
export function textOnlyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || control.value.trim() === '') {
      return null; // Permitir vacío si no es requerido
    }

    // Permitir letras (incluyendo acentos), espacios, guiones y apóstrofes
    const textOnlyRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]+$/;
    
    if (!textOnlyRegex.test(control.value)) {
      return { textOnly: { value: control.value } };
    }

    return null;
  };
}

/**
 * Validador para números de teléfono de USA
 * Acepta formatos: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1 1234567890
 */
export function usPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || control.value.trim() === '') {
      return null; // Permitir vacío si no es requerido
    }

    // Remover espacios, guiones, paréntesis, puntos y el prefijo +1 para validar
    const cleaned = control.value.replace(/[\s\-\(\)\.\+]/g, '').replace(/^1/, '');
    
    // Debe tener exactamente 10 dígitos
    const phoneRegex = /^\d{10}$/;
    
    if (!phoneRegex.test(cleaned)) {
      return { usPhone: { value: control.value } };
    }

    return null;
  };
}

/**
 * Validador mejorado para email
 * Valida formato de email estándar
 */
export function emailFormatValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || control.value.trim() === '') {
      return null; // Permitir vacío si no es requerido
    }

    // Regex mejorado para validar formato de email
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(control.value.trim())) {
      return { emailFormat: { value: control.value } };
    }

    return null;
  };
}

/**
 * Validador para campos que solo permiten números
 * Útil para códigos postales, números de teléfono, etc.
 */
export function numbersOnlyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || control.value.trim() === '') {
      return null; // Permitir vacío si no es requerido
    }

    // Solo números
    const numbersOnlyRegex = /^\d+$/;
    
    if (!numbersOnlyRegex.test(control.value)) {
      return { numbersOnly: { value: control.value } };
    }

    return null;
  };
}


