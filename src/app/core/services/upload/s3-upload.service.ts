import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

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
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was aborted'));
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

