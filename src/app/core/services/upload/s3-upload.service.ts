import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LogService } from '../log/log.service';

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
                method: 'uploadFileToS3',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                statusCode: xhr.status,
                statusText: xhr.statusText
              }
            }
          );
          
          reject(error);
        }
      });

      xhr.addEventListener('error', () => {
        const error = new Error('Upload failed due to network error');
        
        // Registrar error en logs
        void this.logService.logError(
          'Error de red al subir archivo a S3',
          error,
          {
            severity: 'high',
            description: 'Error de red al intentar subir archivo a S3 usando URL presignada',
            source: 's3-upload-service',
            metadata: {
              service: 'S3UploadService',
              method: 'uploadFileToS3',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type
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
              method: 'uploadFileToS3',
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type
            }
          }
        );
        
        reject(error);
      });

      // Iniciar la subida
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
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
    try {
      // 1. Solicitar URL presignada
      const response = await firstValueFrom(
        this.getPresignedUrl(file.name, file.type)
      );

      // 2. Subir archivo directamente a S3
      await this.uploadFileToS3(file, response.presignedUrl, onProgress);

      // 3. Retornar la URL pública
      return response.publicUrl;
    } catch (error) {
      console.error('[S3UploadService] Error uploading file:', error);
      
      // Registrar error en logs
      await this.logService.logError(
        'Error al subir archivo a S3',
        error,
        {
          severity: 'high',
          description: 'Error general al subir archivo a S3 (obtener URL presignada o subir archivo)',
          source: 's3-upload-service',
          metadata: {
            service: 'S3UploadService',
            method: 'uploadFile',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          }
        }
      );
      
      throw error;
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

