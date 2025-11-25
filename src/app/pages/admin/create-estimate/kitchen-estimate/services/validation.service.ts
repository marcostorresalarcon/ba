import { Injectable } from '@angular/core';

/**
 * Servicio de validación para el formulario de Kitchen Estimate
 * Centraliza todas las validaciones antes del submit
 */
@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  /**
   * Valida que un string sea un MongoDB ID válido
   * MongoDB IDs tienen 24 caracteres hexadecimales
   */
  isValidMongoId(id: string | undefined | null): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    // MongoDB ID debe tener exactamente 24 caracteres y ser hexadecimal
    const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
    return mongoIdRegex.test(id);
  }

  /**
   * Valida campos requeridos para el submit de una cotización de cocina
   */
  validateKitchenQuotePayload(payload: Record<string, unknown>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validar userId
    if (!payload['userId']) {
      errors.push('User ID is missing');
    } else if (!this.isValidMongoId(payload['userId'] as string)) {
      errors.push(`Invalid User ID: ${payload['userId']}`);
    }

    // Validar companyId
    if (!payload['companyId']) {
      errors.push('Company ID is missing');
    } else if (!this.isValidMongoId(payload['companyId'] as string)) {
      errors.push(`Invalid Company ID: ${payload['companyId']}`);
    }

    // Validar projectId
    if (!payload['projectId']) {
      errors.push('Project ID is missing. Please create a project first');
    } else if (!this.isValidMongoId(payload['projectId'] as string)) {
      errors.push(`Invalid Project ID: ${payload['projectId']}`);
    }

    // Validar category
    const validCategories = ['kitchen', 'bathroom', 'other'];
    if (!payload['category']) {
      errors.push('Category is missing');
    } else if (!validCategories.includes(payload['category'] as string)) {
      errors.push(`Invalid category: ${payload['category']}`);
    }

    // Validar experience
    if (!payload['experience']) {
      errors.push('Experience level is missing');
    }

    // Validar customer._id si existe
    const customer = payload['customer'] as Record<string, unknown> | undefined;
    if (customer && customer['_id'] && !this.isValidMongoId(customer['_id'] as string)) {
      errors.push(`Invalid Customer ID: ${customer['_id']}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida email
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida que un número esté en un rango
   */
  isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Valida que un string no esté vacío
   */
  isNotEmpty(value: string | undefined | null): boolean {
    return !!value && value.trim().length > 0;
  }

  /**
   * Formatea mensajes de error para mostrar al usuario
   */
  formatValidationErrors(errors: string[]): string {
    if (errors.length === 0) {
      return '';
    }
    
    if (errors.length === 1) {
      return errors[0];
    }
    
    return `Multiple errors found:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;
  }
}

