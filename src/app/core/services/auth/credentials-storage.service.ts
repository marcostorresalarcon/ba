import { Injectable } from '@angular/core';

interface StoredCredentials {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class CredentialsStorageService {
  private readonly storageKey = 'ba:saved-credentials';

  /**
   * Guarda las credenciales en localStorage
   * NOTA: En producción, deberías usar encriptación para el password
   */
  saveCredentials(email: string, password: string): void {
    try {
      const credentials: StoredCredentials = { email, password };
      // Usar btoa para encoding básico (no es encriptación real, pero evita texto plano)
      const encoded = btoa(JSON.stringify(credentials));
      localStorage.setItem(this.storageKey, encoded);
    } catch (error) {
      console.warn('Error saving credentials', error);
    }
  }

  /**
   * Restaura las credenciales guardadas
   */
  getCredentials(): StoredCredentials | null {
    try {
      const encoded = localStorage.getItem(this.storageKey);
      if (!encoded) {
        return null;
      }

      const decoded = atob(encoded);
      return JSON.parse(decoded) as StoredCredentials;
    } catch (error) {
      console.warn('Error restoring credentials', error);
      this.clearCredentials();
      return null;
    }
  }

  /**
   * Limpia las credenciales guardadas
   */
  clearCredentials(): void {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Verifica si hay credenciales guardadas
   */
  hasStoredCredentials(): boolean {
    return localStorage.getItem(this.storageKey) !== null;
  }
}

