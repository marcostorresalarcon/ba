# Plan de Implementación: Reports & Export (CSV/PDF)

## 📋 Resumen Ejecutivo

Implementar funcionalidad de **Reports & Export** que permita exportar datos en formato **CSV** y **PDF** con filtros avanzados por:
- **Fecha** (rango de fechas: startDate, endDate)
- **Estimador** (userId)
- **Estado** (status: draft, sent, approved, rejected, in_progress, completed)
- **Fuente** (leadSource del customer)

---

## 🔍 Análisis de Estado Actual

### ✅ Lo que YA tenemos disponible:

#### Backend (API):
1. **Endpoints de consulta con filtros básicos:**
   - `GET /quote` - Soporta: `companyId`, `projectId`, `category`, `status`, `userId`
   - `GET /project` - Soporta: `companyId`, `customerId`, `estimatorId`, `status`
   - `GET /customer` - Soporta: `companyId`
   - `GET /kpi` - Soporta: `companyId`, `userId`, `startDate`, `endDate` ✅ (tiene filtros de fecha)

2. **Modelos de datos:**
   - `Quote` tiene: `status`, `userId` (estimador), `createdAt`, `updatedAt`
   - `Customer` tiene: `leadSource` ✅ (fuente)
   - `Project` tiene: `status`, `estimatorId`, `createdAt`

3. **Servicio PDF existente:**
   - `PdfService.generateQuotePdf()` - Genera PDF de cotización individual
   - `PdfService.generateInvoicePdf()` - Genera PDF de factura

#### Frontend:
1. **Servicios existentes:**
   - `QuoteService.getQuotes()` - Con filtros básicos
   - `ProjectService.getProjects()` - Con filtros básicos
   - `CustomerService.getCustomers()` - Con filtros básicos
   - `PdfService` - Para generar PDFs individuales

---

## ❌ Lo que FALTA y necesitamos crear:

### Backend (NestJS):

1. **Nuevos endpoints de exportación:**
   - `GET /quote/export/csv` - Exportar cotizaciones a CSV
   - `GET /quote/export/pdf` - Exportar cotizaciones a PDF (reporte consolidado)
   - `GET /project/export/csv` - Exportar proyectos a CSV
   - `GET /project/export/pdf` - Exportar proyectos a PDF

2. **Filtros adicionales en endpoints existentes:**
   - Agregar `startDate` y `endDate` a `GET /quote` (ya existe en `/kpi`)
   - Agregar `leadSource` a `GET /quote` (necesita join con Customer)

3. **Librerías necesarias:**
   - `csv-writer` o `papaparse` para generar CSV
   - `pdfkit` o `jspdf` (ya tenemos jsPDF en frontend, pero para backend necesitamos uno)

### Frontend (Angular):

1. **Nuevo servicio de exportación:**
   - `ReportService` - Manejar exportaciones CSV/PDF

2. **Componente de UI para filtros:**
   - `ReportFiltersComponent` - Formulario con filtros:
     - Selector de rango de fechas
     - Selector de estimador (dropdown de usuarios)
     - Selector de estado (multi-select)
     - Selector de fuente (leadSource) - dropdown con opciones
     - Botones: "Export CSV" y "Export PDF"

3. **Página/Componente de reportes:**
   - `ReportsPage` - Página principal con el componente de filtros
   - Integración con el servicio de exportación

4. **Librerías necesarias:**
   - `papaparse` o similar para generar CSV en frontend (opcional si backend lo hace)
   - `file-saver` para descargar archivos

---

## 📊 Estructura de Datos para Reportes

### Reporte de Cotizaciones (Quotes):

**Campos a incluir en CSV/PDF:**
- Quote ID
- Version Number
- Category (kitchen/bathroom/basement/additional-work)
- Customer Name
- Customer Email
- Customer Phone
- Lead Source (fuente)
- Estimator Name (userId → nombre del usuario)
- Status
- Total Price
- Experience Level
- Created Date
- Updated Date
- Project ID
- Project Name (si está disponible)

### Reporte de Proyectos:

**Campos a incluir en CSV/PDF:**
- Project ID
- Project Name
- Customer Name
- Customer Email
- Lead Source
- Estimator Name
- Status
- Project Type
- Budget
- Start Date
- Expected End Date
- Actual End Date
- Created Date
- Approved Quote ID
- Approved Quote Version

---

## 🎯 Plan de Implementación Detallado

### Fase 1: Backend - Endpoints de Exportación

#### 1.1 Extender endpoint GET /quote con filtros adicionales

**Archivo:** `src/quote/quote.controller.ts` (backend)

**Cambios:**
```typescript
@Get()
async getQuotes(
  @Query('companyId') companyId?: string,
  @Query('projectId') projectId?: string,
  @Query('category') category?: string,
  @Query('status') status?: string,
  @Query('userId') userId?: string,
  @Query('startDate') startDate?: string,  // NUEVO
  @Query('endDate') endDate?: string,      // NUEVO
  @Query('leadSource') leadSource?: string // NUEVO (requiere join con Customer)
) {
  // Implementar lógica de filtrado
}
```

**Validaciones:**
- `startDate` y `endDate` deben ser formato ISO 8601
- Si se proporciona `leadSource`, hacer join con Customer

#### 1.2 Crear endpoint GET /quote/export/csv

**Archivo:** `src/quote/quote.controller.ts`

**Implementación:**
```typescript
@Get('export/csv')
async exportQuotesToCsv(
  @Query() filters: QuoteExportFiltersDto,
  @Res() res: Response
) {
  // 1. Obtener cotizaciones filtradas
  // 2. Hacer join con Customer para obtener leadSource
  // 3. Hacer join con User para obtener nombre del estimador
  // 4. Generar CSV usando csv-writer o papaparse
  // 5. Enviar como descarga
}
```

**DTO:**
```typescript
export class QuoteExportFiltersDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  leadSource?: string;
}
```

#### 1.3 Crear endpoint GET /quote/export/pdf

**Archivo:** `src/quote/quote.controller.ts`

**Implementación:**
- Similar a CSV pero genera PDF consolidado
- Usar `pdfkit` o `jspdf` en backend
- Incluir tabla con todas las cotizaciones filtradas
- Agregar headers, footers, y metadatos del reporte

#### 1.4 Repetir para Projects (opcional)

Si se requiere exportar proyectos también, crear endpoints similares:
- `GET /project/export/csv`
- `GET /project/export/pdf`

---

### Fase 2: Frontend - Servicio de Exportación

#### 2.1 Crear ReportService

**Archivo:** `src/app/core/services/report/report.service.ts`

**Implementación:**
```typescript
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  exportQuotesToCsv(filters: QuoteExportFilters): Observable<Blob> {
    const params = this.buildParams(filters);
    return this.http.get(`${this.baseUrl}/quote/export/csv`, {
      params,
      responseType: 'blob'
    });
  }

  exportQuotesToPdf(filters: QuoteExportFilters): Observable<Blob> {
    const params = this.buildParams(filters);
    return this.http.get(`${this.baseUrl}/quote/export/pdf`, {
      params,
      responseType: 'blob'
    });
  }

  private buildParams(filters: QuoteExportFilters): HttpParams {
    let params = new HttpParams();
    if (filters.companyId) params = params.set('companyId', filters.companyId);
    if (filters.userId) params = params.set('userId', filters.userId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.leadSource) params = params.set('leadSource', filters.leadSource);
    return params;
  }
}
```

**Interfaces:**
```typescript
export interface QuoteExportFilters {
  companyId?: string;
  userId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  leadSource?: string;
}
```

#### 2.2 Instalar dependencias (si es necesario)

```bash
npm install file-saver
npm install --save-dev @types/file-saver
```

---

### Fase 3: Frontend - Componente de Filtros

#### 3.1 Crear ReportFiltersComponent

**Archivo:** `src/app/features/reports/ui/report-filters/report-filters.component.ts`

**Características:**
- Formulario reactivo con todos los filtros
- Selector de rango de fechas (usar Angular Material DatePicker o similar)
- Dropdown de estimadores (cargar desde UserService)
- Multi-select de estados
- Dropdown de fuentes (leadSource) - opciones predefinidas o cargar desde customers
- Botones de exportación: "Export CSV" y "Export PDF"
- Loading states durante la exportación

**Estructura:**
```typescript
@Component({
  selector: 'app-report-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...],
  templateUrl: './report-filters.component.html'
})
export class ReportFiltersComponent {
  protected readonly form = new FormGroup({
    startDate: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null),
    userId: new FormControl<string | null>(null),
    status: new FormControl<string[]>([]),
    leadSource: new FormControl<string | null>(null)
  });

  protected readonly isExporting = signal(false);

  constructor(
    private readonly reportService = inject(ReportService),
    private readonly userService = inject(UserService),
    private readonly notificationService = inject(NotificationService)
  ) {}

  protected async exportCsv(): Promise<void> {
    // Implementar lógica de exportación CSV
  }

  protected async exportPdf(): Promise<void> {
    // Implementar lógica de exportación PDF
  }
}
```

#### 3.2 Crear página de Reportes

**Archivo:** `src/app/pages/reports/reports.page.ts`

**Implementación:**
- Página standalone con el componente de filtros
- Breadcrumbs: Admin Dashboard → Reports
- Solo accesible para admin/estimator

---

### Fase 4: Integración y Testing

#### 4.1 Agregar ruta de reportes

**Archivo:** `src/app/app.routes.ts`

```typescript
{
  path: 'reports',
  loadComponent: () => import('./pages/reports/reports.page').then(m => m.ReportsPage),
  canActivate: [authGuard] // Solo admin/estimator
}
```

#### 4.2 Agregar link en Admin Dashboard

**Archivo:** `src/app/pages/admin-dashboard/admin-dashboard.page.html`

Agregar botón/card para acceder a Reports.

#### 4.3 Testing

- Probar exportación CSV con diferentes filtros
- Probar exportación PDF con diferentes filtros
- Validar que los filtros funcionan correctamente
- Validar formato de fechas
- Validar que los archivos se descargan correctamente

---

## 📦 Dependencias Necesarias

### Backend (NestJS):
```json
{
  "dependencies": {
    "csv-writer": "^1.6.0",
    "pdfkit": "^0.13.0"
  }
}
```

### Frontend (Angular):
```json
{
  "dependencies": {
    "file-saver": "^2.0.5"
  },
  "devDependencies": {
    "@types/file-saver": "^2.0.7"
  }
}
```

---

## 🔐 Consideraciones de Seguridad y Permisos

1. **Control de acceso:**
   - Solo `admin` y `estimator` pueden acceder a reportes
   - Los `estimator` solo pueden ver reportes de su propia compañía
   - Los `admin` pueden ver reportes de todas las compañías

2. **Filtros automáticos:**
   - Si el usuario es `estimator`, filtrar automáticamente por su `companyId`
   - Si el usuario es `estimator`, filtrar automáticamente por su `userId` (opcional)

3. **Límites de datos:**
   - Considerar paginación o límites para exportaciones grandes
   - Mostrar advertencia si el resultado es muy grande (>1000 registros)

---

## 📝 Checklist de Implementación

### Backend:
- [ ] Extender `GET /quote` con filtros `startDate`, `endDate`, `leadSource`
- [ ] Crear DTO `QuoteExportFiltersDto`
- [ ] Implementar `GET /quote/export/csv`
- [ ] Implementar `GET /quote/export/pdf`
- [ ] Agregar joins necesarios (Customer para leadSource, User para nombre estimador)
- [ ] Instalar dependencias (`csv-writer`, `pdfkit`)
- [ ] Testing de endpoints

### Frontend:
- [ ] Crear `ReportService`
- [ ] Crear interfaces `QuoteExportFilters`
- [ ] Crear `ReportFiltersComponent`
- [ ] Crear `ReportsPage`
- [ ] Agregar ruta `/reports`
- [ ] Agregar link en Admin Dashboard
- [ ] Instalar `file-saver`
- [ ] Implementar descarga de archivos
- [ ] Agregar loading states
- [ ] Agregar manejo de errores
- [ ] Testing de UI

---

## 🎨 Diseño UI Sugerido

### Componente de Filtros:
```
┌─────────────────────────────────────────┐
│  Reports & Export                       │
├─────────────────────────────────────────┤
│  Date Range:  [Start] ──── [End]        │
│  Estimator:   [Dropdown ▼]              │
│  Status:      [Multi-select ▼]          │
│  Lead Source: [Dropdown ▼]               │
│                                          │
│  [Export CSV]  [Export PDF]             │
└─────────────────────────────────────────┘
```

---

## 📚 Referencias

- Documentación de API: `docs/API_DOCUMENTATION.md`
- Servicio PDF existente: `src/app/core/services/pdf/pdf.service.ts`
- Servicio Quote: `src/app/core/services/quote/quote.service.ts`

---

## ⏱️ Estimación de Tiempo

- **Backend:** 8-12 horas
- **Frontend:** 6-8 horas
- **Testing:** 2-4 horas
- **Total:** 16-24 horas

---

**Última actualización:** 26 de Enero de 2026
