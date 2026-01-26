# HU: Controlled Editing + Audit Log

## 📋 Descripción de la Historia de Usuario

**Título**: Controlled Editing + Audit Log: Bloquear campos tras "sent", override con registro de cambios.

**Objetivo**: Implementar un sistema de control de edición que bloquee los campos de una cotización una vez que está en estado "sent", permitiendo ediciones solo mediante un sistema de override con registro completo de auditoría.

---

## 🎯 Análisis de Requisitos

### 1. **Bloqueo de Campos tras "sent"**

**Comportamiento esperado:**
- Cuando una cotización está en estado `sent`, todos los campos del formulario deben estar **bloqueados/deshabilitados** por defecto
- Los campos bloqueados no deben ser editables para usuarios normales
- El formulario debe mostrar visualmente que los campos están bloqueados (estilos deshabilitados)

**Campos afectados:**
- Todos los campos del formulario de cotización:
  - Información del cliente (customer)
  - Información del proyecto (projectName, category, experience)
  - Campos dinámicos de kitchenInformation/bathroomInformation/etc.
  - Materiales (materials)
  - Archivos multimedia (countertopsFiles, backsplashFiles, audioNotes, sketchFiles)
  - Notas y comentarios (notes, additionalComments)
  - Campos de presupuesto (roughQuote, clientBudget)
  - Estado (status) - aunque este puede tener lógica especial

**Excepciones:**
- El campo `status` puede seguir siendo editable para transiciones de estado (aprobación/rechazo)
- Los campos de solo lectura (como `experience` que ya está deshabilitado) deben mantenerse así

---

### 2. **Sistema de Override**

**Comportamiento esperado:**
- Usuarios con permisos especiales (admin, estimator) pueden **desbloquear** los campos para editar
- El override debe ser **explícito** (botón "Enable Editing" o similar)
- Al activar el override, se debe mostrar una advertencia indicando que los cambios serán registrados
- Opcionalmente, se puede requerir una razón/comentario para el override

**Permisos:**
- **Admin**: Puede hacer override en cualquier momento
- **Estimator**: Puede hacer override en cotizaciones que creó o tiene asignadas
- **Customer**: No puede hacer override (solo lectura)

**UI/UX:**
- Botón prominente "Enable Editing" cuando los campos están bloqueados
- Indicador visual de que se está en modo "override"
- Botón "Save Changes" que registra los cambios en el audit log
- Botón "Cancel" para desactivar el override sin guardar

---

### 3. **Audit Log (Registro de Cambios)**

**Información a registrar:**
Para cada cambio realizado durante un override:

```typescript
interface AuditLogEntry {
  _id: string;
  quoteId: string; // ID de la cotización modificada
  field: string; // Nombre del campo modificado (ej: "totalPrice", "kitchenInformation.countertopsFiles")
  oldValue: unknown; // Valor anterior
  newValue: unknown; // Valor nuevo
  changedBy: string; // ID del usuario que hizo el cambio
  changedByName?: string; // Nombre del usuario (para display)
  changedAt: string; // Timestamp ISO 8601
  reason?: string; // Razón opcional del cambio
  statusBefore: QuoteStatus; // Estado antes del cambio
  statusAfter: QuoteStatus; // Estado después del cambio (si cambió)
}
```

**Campos a registrar:**
- Cambios en campos individuales (field-level tracking)
- Cambios en objetos anidados (ej: `kitchenInformation.woodHoodVentThirtySix`)
- Cambios en arrays (ej: agregar/eliminar archivos en `countertopsFiles`)
- Cambios en el estado (status)

**Backend:**
- Endpoint para crear entradas de audit log: `POST /quote/:id/audit-log`
- Endpoint para obtener historial: `GET /quote/:id/audit-log`
- El backend debe validar que el usuario tiene permisos para hacer override

---

### 4. **Visualización del Historial**

**Componente de Historial:**
- Mostrar lista de cambios ordenados por fecha (más reciente primero)
- Mostrar: campo, valor anterior → valor nuevo, usuario, fecha, razón
- Filtros opcionales: por campo, por usuario, por rango de fechas
- Exportación opcional a PDF/CSV

**Ubicación:**
- Pestaña/sección en `quote-detail.page` para mostrar el historial de cambios
- Indicador visual en el formulario cuando hay cambios registrados

---

## 🔄 Flujo de Trabajo

### Flujo Normal (Sin Override):
1. Cotización en estado `sent` → Campos bloqueados
2. Usuario intenta editar → Campos deshabilitados, no se puede editar
3. Usuario puede ver la cotización en modo solo lectura

### Flujo con Override:
1. Cotización en estado `sent` → Campos bloqueados
2. Admin/Estimator hace clic en "Enable Editing"
3. Sistema muestra advertencia: "Los cambios serán registrados en el audit log"
4. Opcional: Usuario ingresa razón/comentario para el override
5. Campos se desbloquean, usuario puede editar
6. Usuario hace cambios y guarda
7. Sistema registra cada cambio en el audit log
8. Backend valida permisos y guarda cambios + audit log
9. Campos se vuelven a bloquear automáticamente

---

## 📐 Diseño Técnico

### Frontend

#### 1. **Modelo de Datos**

```typescript
// src/app/core/models/audit-log.model.ts
export interface AuditLogEntry {
  _id: string;
  quoteId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedByName?: string;
  changedAt: string;
  reason?: string;
  statusBefore: QuoteStatus;
  statusAfter: QuoteStatus;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}
```

#### 2. **Servicio de Audit Log**

```typescript
// src/app/core/services/audit-log/audit-log.service.ts
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  getAuditLog(quoteId: string): Observable<AuditLogResponse> { }
  createAuditLogEntry(quoteId: string, entry: Partial<AuditLogEntry>): Observable<AuditLogEntry> { }
}
```

#### 3. **Modificaciones en Formularios**

**KitchenQuoteFormComponent:**
- Agregar signal `isOverrideMode = signal(false)`
- Agregar computed `isLocked = computed(() => this.quote()?.status === 'sent' && !this.isOverrideMode())`
- Método `enableOverride()` que activa el modo override
- Método `disableOverride()` que desactiva el modo override
- Al guardar, comparar valores anteriores vs nuevos y crear entradas de audit log

**Lógica de bloqueo:**
```typescript
// En el componente del formulario
effect(() => {
  const locked = this.isLocked();
  const form = this.form;
  
  if (locked) {
    // Deshabilitar todos los campos excepto status (si aplica)
    Object.keys(form.controls).forEach(key => {
      if (key !== 'status') { // status puede tener lógica especial
        form.controls[key].disable({ emitEvent: false });
      }
    });
  } else {
    // Habilitar campos cuando está en override
    Object.keys(form.controls).forEach(key => {
      form.controls[key].enable({ emitEvent: false });
    });
  }
});
```

#### 4. **Componente de Override**

```typescript
// src/app/shared/ui/override-mode-banner/override-mode-banner.component.ts
@Component({
  selector: 'app-override-mode-banner',
  standalone: true,
  // ...
})
export class OverrideModeBannerComponent {
  @Input() isOverrideMode = false;
  @Input() reason = signal<string | null>(null);
  @Output() disableOverride = new EventEmitter<void>();
}
```

#### 5. **Componente de Historial**

```typescript
// src/app/features/quotes/ui/quote-audit-log/quote-audit-log.component.ts
@Component({
  selector: 'app-quote-audit-log',
  standalone: true,
  // ...
})
export class QuoteAuditLogComponent {
  @Input({ required: true }) quoteId!: string;
  protected readonly auditLog = signal<AuditLogEntry[]>([]);
  // ...
}
```

---

### Backend (NestJS)

#### 1. **Modelo de Audit Log**

```typescript
// src/modules/audit-log/schemas/audit-log.schema.ts
@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'Quote' })
  quoteId: Types.ObjectId;

  @Prop({ required: true })
  field: string;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  oldValue: unknown;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  newValue: unknown;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  changedBy: Types.ObjectId;

  @Prop()
  reason?: string;

  @Prop({ required: true })
  statusBefore: string;

  @Prop({ required: true })
  statusAfter: string;
}
```

#### 2. **Servicio de Audit Log**

```typescript
// src/modules/audit-log/audit-log.service.ts
@Injectable()
export class AuditLogService {
  async createEntry(data: CreateAuditLogDto): Promise<AuditLog> { }
  async getQuoteAuditLog(quoteId: string): Promise<AuditLog[]> { }
  async trackQuoteUpdate(quoteId: string, oldQuote: Quote, newQuote: Quote, userId: string, reason?: string): Promise<void> { }
}
```

#### 3. **Modificaciones en QuoteService**

- Validar permisos antes de permitir override
- Al actualizar una cotización en estado `sent`, comparar valores y crear entradas de audit log
- Endpoint especial para override: `PATCH /quote/:id/override` que requiere razón

---

## ✅ Checklist de Implementación

### Frontend
- [ ] Crear modelo `AuditLogEntry` y `AuditLogResponse`
- [ ] Crear servicio `AuditLogService` con métodos para obtener y crear entradas
- [ ] Modificar `KitchenQuoteFormComponent` para bloquear campos cuando `status === 'sent'`
- [ ] Agregar lógica de override mode (botón, señal, computed)
- [ ] Implementar comparación de valores antes/después al guardar
- [ ] Crear componente `OverrideModeBannerComponent`
- [ ] Crear componente `QuoteAuditLogComponent` para mostrar historial
- [ ] Integrar componente de historial en `quote-detail.page`
- [ ] Aplicar misma lógica a `AdditionalWorkQuoteFormComponent`
- [ ] Agregar estilos visuales para campos bloqueados

### Backend
- [ ] Crear schema `AuditLog` en MongoDB
- [ ] Crear módulo `AuditLogModule` con servicio y controlador
- [ ] Implementar endpoint `GET /quote/:id/audit-log`
- [ ] Implementar endpoint `POST /quote/:id/audit-log`
- [ ] Modificar `QuoteService.updateQuote()` para validar permisos de override
- [ ] Implementar método `trackQuoteUpdate()` que compara valores y crea entradas
- [ ] Agregar validación de permisos (admin/estimator) para override
- [ ] Crear endpoint `PATCH /quote/:id/override` con validación de razón

### Testing
- [ ] Test: Campos se bloquean cuando status es "sent"
- [ ] Test: Admin puede activar override
- [ ] Test: Customer no puede activar override
- [ ] Test: Cambios se registran correctamente en audit log
- [ ] Test: Historial muestra cambios correctamente
- [ ] Test: Backend valida permisos correctamente

---

## 🎨 Consideraciones de UX

1. **Feedback Visual:**
   - Campos bloqueados: estilo deshabilitado (grayed out)
   - Modo override: banner amarillo/naranja indicando que está en modo edición
   - Indicador de cambios pendientes: badge o contador

2. **Confirmaciones:**
   - Al activar override: modal de confirmación con advertencia
   - Al guardar con override: confirmar que los cambios serán registrados
   - Al cancelar override: confirmar si hay cambios sin guardar

3. **Información Contextual:**
   - Mostrar última fecha de modificación
   - Mostrar usuario que hizo el último cambio
   - Mostrar número total de cambios registrados

---

## 📝 Notas Adicionales

- El sistema de versiones existente puede complementar el audit log
- Considerar límites de rendimiento si hay muchos cambios (paginación en historial)
- El audit log debe ser inmutable (no se pueden editar/eliminar entradas)
- Considerar exportación del historial para cumplimiento/auditoría
