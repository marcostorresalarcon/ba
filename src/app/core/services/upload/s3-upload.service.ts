import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LogService } from '../log/log.service';
import { LoadingService } from '../loading/loading.service';

export interface PresignedUrlRequest {
  fileName: string;
  contentType?: string;
}

export interface PresignedUrlResponse {
  presignedUrl: string;
  publicUrl: string;
  key: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class S3UploadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly logService = inject(LogService);
  private readonly loadingService = inject(LoadingService);

  /**
   * Solicita una URL presignada para subir un archivo a S3
   * @param fileName Nombre del archivo con extensión
   * @param contentType Tipo MIME del archivo (opcional)
   * @returns Observable con la respuesta que incluye presignedUrl y publicUrl
   */
  getPresignedUrl(fileName: string, contentType?: string): Observable<PresignedUrlResponse> {
    const endpoint = `${this.baseUrl}/upload/presigned-url`;
    const payload: PresignedUrlRequest = {
      fileName,
      ...(contentType && { contentType })
    };
    return this.http.post<PresignedUrlResponse>(endpoint, payload);
  }

  /**
   * Sube un archivo directamente a S3 usando una URL presignada
   * En web, intenta primero con fetch (mejor manejo de CORS), luego XHR como fallback
   * En Capacitor, usa fetch directamente
   * @param file Archivo a subir
   * @param presignedUrl URL presignada obtenida de getPresignedUrl
   * @param onProgress Callback opcional para reportar progreso
   * @returns Promise que se resuelve con la URL pública del archivo subido
   */
  async uploadFileToS3(
    file: File,
    presignedUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    const isNative = Capacitor.isNativePlatform();

    // En Capacitor, usar fetch directamente
    if (isNative) {
      return this.uploadFileToS3WithFetch(file, presignedUrl);
    } else {
      // En web, intentar primero con fetch (mejor manejo de CORS)
      // Si falla, usar XHR como fallback
      try {
        return await this.uploadFileToS3WithFetch(file, presignedUrl);
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        
        // Si es un error de CORS o red, intentar con XHR
        const shouldRetryWithXHR = 
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('network') ||
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('CORS');
        
        if (shouldRetryWithXHR) {
          // Intentar con XHR como fallback
          try {
            return await this.uploadFileToS3WithXHR(file, presignedUrl, onProgress);
          } catch (xhrError) {
            // Si ambos fallan, lanzar el error más descriptivo
            const xhrErrorMessage = xhrError instanceof Error ? xhrError.message : String(xhrError);
            const combinedError = new Error(
              `Upload failed with both fetch and XHR. Fetch error: ${errorMessage}. XHR error: ${xhrErrorMessage}`
            );
            
            await this.logService.logError(
              'Error al subir archivo a S3: fetch y XHR fallaron',
              combinedError,
              {
                severity: 'critical',
                description: 'Tanto fetch como XMLHttpRequest fallaron al subir archivo. Verificar configuración de CORS en S3.',
                source: 's3-upload-service',
                metadata: {
                  service: 'S3UploadService',
                  method: 'uploadFileToS3',
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type,
                  cleanContentType: this.cleanContentType(file.type),
                  platform: 'web',
                  fetchError: errorMessage.substring(0, 500),
                  xhrError: xhrErrorMessage.substring(0, 500),
                  presignedUrlDomain: presignedUrl ? new URL(presignedUrl).hostname : 'unknown',
                  troubleshooting: 'Verificar configuración de CORS en el bucket S3. El bucket debe permitir PUT desde el origen de la aplicación.'
                }
              }
            );
            
            throw combinedError;
          }
        } else {
          // Si no es un error de red/CORS, lanzar el error original
          throw fetchError;
        }
      }
    }
  }

  /**
   * Sube archivo usando fetch API (para Capacitor y como primera opción en web)
   */
  private async uploadFileToS3WithFetch(
    file: File,
    presignedUrl: string
  ): Promise<string> {
    // Limpiar Content-Type para evitar problemas con codecs (ej: "audio/mp4; codecs=mp4a.40.2")
    const cleanContentType = this.cleanContentType(file.type);

    try {
      // Intentar con fetch
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': cleanContentType
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const error = new Error(`Upload failed with status ${response.status}: ${errorText}`);
        
        // Registrar error en logs
        await this.logService.logError(
          `Error al subir archivo a S3: Status ${response.status}`,
          error,
          {
            severity: 'high',
            description: `Error HTTP al subir archivo a S3. Status: ${response.status}, StatusText: ${response.statusText}`,
            source: 's3-upload-service',
            metadata: {
              service: 'S3UploadService',
              method: 'uploadFileToS3WithFetch',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              cleanContentType,
              statusCode: response.status,
              statusText: response.statusText,
              errorResponse: errorText.substring(0, 500),
              presignedUrlDomain: presignedUrl ? new URL(presignedUrl).hostname : 'unknown',
              platform: Capacitor.isNativePlatform() ? 'capacitor' : 'web'
            }
          }
        );
        
        throw error;
      }

      // Extraer la URL pública de la presignedUrl (remover parámetros de query)
      const publicUrl = presignedUrl.split('?')[0];
      return publicUrl;
    } catch (error) {
      // Si el error ya fue manejado arriba (status error), lanzarlo directamente
      if (error instanceof Error && error.message.includes('Upload failed with status')) {
        throw error;
      }

      // Para errores de red/CORS, registrar y lanzar
      const errorMessage = error instanceof Error ? error.message : String(error);
      const logError = new Error(`Upload failed with fetch: ${errorMessage}`);

      await this.logService.logError(
        'Error al subir archivo a S3 con fetch',
        logError,
        {
          severity: 'high',
          description: `Error al subir archivo a S3 usando fetch: ${errorMessage}. Posible problema de CORS.`,
          source: 's3-upload-service',
          metadata: {
            service: 'S3UploadService',
            method: 'uploadFileToS3WithFetch',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            cleanContentType,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            errorMessage: errorMessage.substring(0, 500),
            presignedUrlDomain: presignedUrl ? new URL(presignedUrl).hostname : 'unknown',
            platform: Capacitor.isNativePlatform() ? 'capacitor' : 'web',
            troubleshooting: 'Verificar configuración de CORS en el bucket S3. El bucket debe permitir PUT desde el origen de la aplicación.'
          }
        }
      );

      throw logError;
    }
  }

  /**
   * Fallback usando XMLHttpRequest cuando fetch falla en Capacitor
   */
  private async uploadFileToS3WithXHRFallback(
    file: File,
    presignedUrl: string,
    contentType: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const publicUrl = presignedUrl.split('?')[0];
          resolve(publicUrl);
        } else {
          const error = new Error(`Upload failed with status ${xhr.status}`);
          reject(error);
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error (XHR fallback)'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was aborted (XHR fallback)'));
      });

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(file);
    });
  }

  /**
   * Limpia el Content-Type removiendo parámetros como codecs que pueden causar problemas
   */
  private cleanContentType(contentType: string | null | undefined): string {
    if (!contentType) {
      return 'application/octet-stream';
    }

    // Remover parámetros después del punto y coma (ej: "audio/mp4; codecs=mp4a.40.2" -> "audio/mp4")
    const baseType = contentType.split(';')[0].trim();

    // Mapear tipos problemáticos a tipos más seguros
    const typeMap: Record<string, string> = {
      'audio/mp4': 'audio/m4a',
      'audio/x-m4a': 'audio/m4a'
    };

    return typeMap[baseType] || baseType || 'application/octet-stream';
  }

  /**
   * Sube archivo usando XMLHttpRequest (para web, soporta progreso)
   */
  private async uploadFileToS3WithXHR(
    file: File,
    presignedUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Configurar callback de progreso
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            });
          }
        });
      }

      // Configurar callbacks de éxito y error
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          // Extraer la URL pública de la presignedUrl (remover parámetros de query)
          const publicUrl = presignedUrl.split('?')[0];
          resolve(publicUrl);
        } else {
          const error = new Error(`Upload failed with status ${xhr.status}`);
          
          // Registrar error en logs
          void this.logService.logError(
            `Error al subir archivo a S3: Status ${xhr.status}`,
            error,
            {
              severity: 'high',
              description: `Error HTTP al subir archivo a S3. Status: ${xhr.status}`,
              source: 's3-upload-service',
              metadata: {
                service: 'S3UploadService',
                method: 'uploadFileToS3WithXHR',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                statusCode: xhr.status,
                statusText: xhr.statusText,
                platform: 'web'
              }
            }
          );
          
          reject(error);
        }
      });

      xhr.addEventListener('error', (event) => {
        const errorDetails = {
          status: xhr.status,
          statusText: xhr.statusText,
          readyState: xhr.readyState,
          responseText: xhr.responseText?.substring(0, 500) || 'No response',
          presignedUrlDomain: presignedUrl ? new URL(presignedUrl).hostname : 'unknown'
        };
        
        const error = new Error(`Upload failed due to network error. Details: ${JSON.stringify(errorDetails)}`);
        
        // Registrar error en logs con más detalles
        void this.logService.logError(
          'Error de red al subir archivo a S3',
          error,
          {
            severity: 'high',
            description: `Error de red al intentar subir archivo a S3 usando URL presignada (Web). Posible problema de CORS o configuración del bucket.`,
            source: 's3-upload-service',
            metadata: {
              service: 'S3UploadService',
              method: 'uploadFileToS3WithXHR',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              cleanContentType: this.cleanContentType(file.type),
              platform: 'web',
              ...errorDetails,
              troubleshooting: 'Verificar configuración de CORS en el bucket S3. El bucket debe permitir PUT desde el origen de la aplicación.'
            }
          }
        );
        
        reject(error);
      });

      xhr.addEventListener('abort', () => {
        const error = new Error('Upload was aborted');
        
        // Registrar error en logs
        void this.logService.logError(
          'Subida de archivo a S3 cancelada',
          error,
          {
            severity: 'low',
            description: 'La subida del archivo a S3 fue cancelada por el usuario',
            source: 's3-upload-service',
            metadata: {
              service: 'S3UploadService',
              method: 'uploadFileToS3WithXHR',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              platform: 'web'
            }
          }
        );
        
        reject(error);
      });

      // Iniciar la subida
      xhr.open('PUT', presignedUrl);
      
      // Usar el Content-Type limpio para evitar problemas
      const cleanContentType = this.cleanContentType(file.type);
      xhr.setRequestHeader('Content-Type', cleanContentType);
      
      // No establecer otros headers que puedan interferir con la firma de AWS
      // AWS S3 requiere que los headers coincidan exactamente con los usados para firmar la URL
      xhr.send(file);
    });
  }

  /**
   * Método completo que solicita la URL presignada y sube el archivo
   * @param file Archivo a subir
   * @param onProgress Callback opcional para reportar progreso
   * @returns Promise que se resuelve con la URL pública del archivo subido
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    let presignedUrlResponse: PresignedUrlResponse | null = null;

    // Iniciar loading para la subida a S3 (la petición HTTP ya tiene su propio loading)
    this.loadingService.start();

    try {
      // 1. Solicitar URL presignada (ya tiene loading del interceptor HTTP)
      try {
        presignedUrlResponse = await firstValueFrom(
          this.getPresignedUrl(file.name, file.type)
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Registrar error específico de obtener URL presignada
        await this.logService.logError(
          'Error al obtener URL presignada de S3',
          error,
          {
            severity: 'high',
            description: `Error al solicitar URL presignada desde el backend: ${errorMessage}`,
            source: 's3-upload-service',
            metadata: {
              service: 'S3UploadService',
              method: 'uploadFile',
              step: 'getPresignedUrl',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              endpoint: `${this.baseUrl}/upload/presigned-url`
            }
          }
        );
        
        throw new Error(`Failed to get presigned URL: ${errorMessage}`);
      }

      // 2. Subir archivo directamente a S3
      try {
        await this.uploadFileToS3(file, presignedUrlResponse.presignedUrl, onProgress);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Registrar error específico de subida a S3
        await this.logService.logError(
          'Error al subir archivo a S3 después de obtener URL presignada',
          error,
          {
            severity: 'high',
            description: `Error al subir archivo a S3 usando URL presignada: ${errorMessage}`,
            source: 's3-upload-service',
            metadata: {
              service: 'S3UploadService',
              method: 'uploadFile',
              step: 'uploadFileToS3',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              presignedUrl: presignedUrlResponse.presignedUrl.substring(0, 100) + '...' // Solo primeros 100 caracteres por seguridad
            }
          }
        );
        
        throw new Error(`Failed to upload file to S3: ${errorMessage}`);
      }

      // 3. Retornar la URL pública
      return presignedUrlResponse.publicUrl;
    } catch (error) {
      // Este catch captura errores que no fueron manejados en los try-catch internos
      // o errores de formato inesperado
      console.error('[S3UploadService] Error uploading file:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Solo registrar si no fue registrado ya en los pasos anteriores
      if (!errorMessage.includes('Failed to get presigned URL') && 
          !errorMessage.includes('Failed to upload file to S3')) {
        await this.logService.logError(
          'Error inesperado al subir archivo a S3',
          error,
          {
            severity: 'high',
            description: `Error inesperado al subir archivo a S3: ${errorMessage}`,
            source: 's3-upload-service',
            metadata: {
              service: 'S3UploadService',
              method: 'uploadFile',
              step: 'unknown',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              errorType: error instanceof Error ? error.constructor.name : typeof error
            }
          }
        );
      }
      
      throw error;
    } finally {
      // Detener loading cuando termine la subida (éxito o error)
      this.loadingService.stop();
    }
  }

  /**
   * Sube múltiples archivos en paralelo
   * @param files Array de archivos a subir
   * @param onProgress Callback opcional para reportar progreso de cada archivo
   * @returns Promise que se resuelve con un array de URLs públicas
   */
  async uploadMultipleFiles(
    files: File[],
    onProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<string[]> {
    const uploadPromises = files.map((file, index) =>
      this.uploadFile(file, (progress) => onProgress?.(index, progress))
    );

    return Promise.all(uploadPromises);
  }
}

