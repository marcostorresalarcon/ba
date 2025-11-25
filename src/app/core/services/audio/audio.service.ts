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
}



