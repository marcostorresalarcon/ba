import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AudioSummaryResponse {
  success: boolean;
  data: {
    transcription: string;
    summary: string;
  };
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  summarizeAudio(file: File): Observable<AudioSummaryResponse> {
    const formData = new FormData();
    formData.append('audio', file);

    return this.http.post<AudioSummaryResponse>(`${this.baseUrl}/audio/summarize`, formData);
  }

  /**
   * Procesa un audio desde una URL de S3 y genera un resumen
   * @param url URL del archivo de audio en S3
   * @returns Observable con la respuesta del resumen
   */
  summarizeAudioFromUrl(url: string): Observable<AudioSummaryResponse> {
    return this.http.post<AudioSummaryResponse>(`${this.baseUrl}/audio/summarize-from-url`, { url });
  }
}



