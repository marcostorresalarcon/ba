# AGENTS - Guía de Mejores Prácticas y Errores Comunes

Este documento define reglas críticas para evitar errores comunes en el desarrollo del proyecto BA. Los agentes de IA deben seguir estas directrices estrictamente.

## 🚨 Errores Críticos a Evitar

### 1. Gestión de Estado de Procesamiento (Loading States)

**❌ ERROR COMÚN:**
```typescript
// ❌ INCORRECTO: El estado isProcessing nunca se resetea
protected readonly isProcessing = signal(false);

handleAction(): void {
  this.isProcessing.set(true);
  this.service.action().subscribe({
    next: () => {
      // Estado nunca se resetea si hay error
    }
  });
}
```

**✅ SOLUCIÓN CORRECTA:**
```typescript
// ✅ CORRECTO: Resetear el estado en todos los casos
protected readonly isProcessing = signal(false);

handleAction(): void {
  this.isProcessing.set(true);
  this.service.action()
    .pipe(
      takeUntilDestroyed(),
      finalize(() => this.isProcessing.set(false)) // Siempre resetea
    )
    .subscribe({
      next: (result) => {
        // Manejar éxito
      },
      error: (error) => {
        // Manejar error - el estado ya se resetea en finalize
      }
    });
}

// O usar effect para resetear cuando cambia el input relacionado
constructor() {
  effect(() => {
    const data = this.inputData();
    if (data && this.isProcessing()) {
      setTimeout(() => this.isProcessing.set(false), 100);
    }
  });
}
```

**Regla:** Siempre resetear estados de procesamiento (`isProcessing`, `isLoading`, etc.) usando `finalize()` en RxJS o `effect()` cuando cambien los datos relacionados.

---

### 2. Estados de Quote (QuoteStatus)

**⚠️ IMPORTANTE - Flujo Correcto de Estados:**

El flujo de estados de cotizaciones es el siguiente:
- **DRAFT**: Cuando se presiona el botón "Save as Draft" (borrador)
- **SENT**: Cuando se hace submit (crear cotización) - NO usar PENDING
- **APPROVED**: Cuando el cliente aprueba la cotización
- **REJECTED**: Cuando el cliente rechaza (debe ingresar comentario obligatorio)
- **IN_PROGRESS**: Cuando el customer inicia el trabajo
- **COMPLETED**: Cuando el Customer cambia el estado a completado

**❌ ERROR COMÚN:**
```typescript
// ❌ INCORRECTO: Incluir 'pending' - NO EXISTE, es igual a DRAFT
export type QuoteStatus = 'draft' | 'pending' | 'approved' | 'sent' | 'rejected' | 'in_progress' | 'completed';

// ❌ INCORRECTO: Crear con status 'pending' en submit
if (finalStatus === 'draft' && !this.isExplicitDraft) {
  finalStatus = 'pending'; // ❌ INCORRECTO
}
```

**✅ SOLUCIÓN CORRECTA:**
```typescript
// ✅ CORRECTO: NO incluir 'pending', solo DRAFT
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'in_progress' | 'completed';

// ✅ CORRECTO: Crear con status 'sent' en submit (no draft explícito)
if (finalStatus === 'draft' && !this.isExplicitDraft) {
  finalStatus = 'sent'; // ✅ CORRECTO: Submit crea con SENT
}

// ✅ CORRECTO: Orden que refleja el flujo real
const statusOptions = ['draft', 'sent', 'approved', 'rejected', 'in_progress', 'completed'];
```

**Regla:** 
- **NO usar `'pending'`** - PENDING y DRAFT son iguales, solo usar DRAFT
- Al hacer submit (crear cotización), el status debe ser `'sent'` (no 'pending')
- Solo usar `'draft'` cuando explícitamente se presiona "Save as Draft"
- El flujo es: `draft` → `sent` → `approved`/`rejected` → `in_progress` → `completed`
- Actualizar TODOS los lugares donde se use `QuoteStatus` o `statusOptions`:
  - Modelos TypeScript
  - Formularios (statusOptions)
  - Componentes de visualización (getStatusColor)
  - Filtros y listas
  - Servicios y lógica de aprobación

---

### 3. Colores de Estado (getStatusColor)

**❌ ERROR COMÚN:**
```typescript
// ❌ INCORRECTO: Falta el caso 'pending'
protected getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-slate/20 text-slate',
    sent: 'bg-blue-500/20 text-blue-700',
    approved: 'bg-pine/20 text-pine',
    rejected: 'bg-red-500/20 text-red-700',
    in_progress: 'bg-yellow-500/20 text-yellow-700',
    completed: 'bg-green-600/20 text-green-700'
  };
  return colors[status] ?? 'bg-slate/20 text-slate';
}
```

**✅ SOLUCIÓN CORRECTA:**
```typescript
// ✅ CORRECTO: Incluir todos los estados (SIN PENDING)
protected getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-slate/20 text-slate',
    sent: 'bg-blue-500/20 text-blue-700',
    approved: 'bg-pine/20 text-pine',
    rejected: 'bg-red-500/20 text-red-700',
    in_progress: 'bg-yellow-500/20 text-yellow-700',
    completed: 'bg-green-600/20 text-green-700'
  };
  return colors[status] ?? 'bg-slate/20 text-slate';
}
```

**Regla:** Cuando se agrega un nuevo estado a `QuoteStatus`, actualizar `getStatusColor()` en TODOS los componentes que lo usen:
- `QuoteDetailPage`
- `QuotesPage`
- `QuoteListComponent`
- Cualquier otro componente que muestre estados

---

### 4. Comentarios de Rechazo (RejectionComments)

**❌ ERROR COMÚN:**
```typescript
// ❌ INCORRECTO: No validar que el comentario sea requerido
rejectQuote(id: string, comment?: string): Observable<Quote> {
  return this.http.post<Quote>(endpoint, { comment });
}
```

**✅ SOLUCIÓN CORRECTA:**
```typescript
// ✅ CORRECTO: Validar que el comentario sea obligatorio
rejectQuote(
  id: string,
  comment: string, // Requerido, no opcional
  rejectedBy?: string,
  mediaFiles?: string[]
): Observable<Quote> {
  if (!comment || comment.trim().length < 10) {
    throw new Error('El comentario de rechazo es obligatorio y debe tener al menos 10 caracteres');
  }
  return this.http.post<Quote>(endpoint, { comment, rejectedBy, mediaFiles });
}
```

**Regla:** 
- El campo `comment` en `rejectionComments` es OBLIGATORIO cuando `status === 'rejected'`
- Validar mínimo 10 caracteres en el frontend
- El backend también debe validar esto

---

### 5. Transiciones de Estado Válidas

**❌ ERROR COMÚN:**
```typescript
// ❌ INCORRECTO: Permitir transiciones inválidas
updateStatus(newStatus: QuoteStatus): void {
  this.quote.status = newStatus; // Sin validación
}
```

**✅ SOLUCIÓN CORRECTA:**
```typescript
// ✅ CORRECTO: Validar transiciones válidas (SIN PENDING)
private readonly validTransitions: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent'], // Draft solo puede ir a SENT (submit)
  sent: ['approved', 'rejected', 'in_progress'], // Customer puede aprobar/rechazar o iniciar trabajo
  approved: ['in_progress'], // Aprobada puede iniciar trabajo
  rejected: ['draft'], // Rechazada puede volver a draft para editar
  in_progress: ['completed'], // Customer puede marcar como completado
  completed: [] // Estado final
};

updateStatus(newStatus: QuoteStatus): void {
  const currentStatus = this.quote.status;
  const validNextStatuses = this.validTransitions[currentStatus] || [];
  
  if (!validNextStatuses.includes(newStatus)) {
    throw new Error(`Transición inválida: ${currentStatus} → ${newStatus}`);
  }
  
  this.quote.status = newStatus;
}
```

**Regla:** Validar transiciones de estado según el flujo documentado en la API.

---

### 6. Manejo de Errores en Observables

**❌ ERROR COMÚN:**
```typescript
// ❌ INCORRECTO: No manejar errores
this.service.getData().subscribe({
  next: (data) => {
    this.data.set(data);
  }
  // Sin manejo de error
});
```

**✅ SOLUCIÓN CORRECTA:**
```typescript
// ✅ CORRECTO: Siempre manejar errores
this.service.getData()
  .pipe(
    takeUntilDestroyed(),
    finalize(() => this.isLoading.set(false))
  )
  .subscribe({
    next: (data) => {
      this.data.set(data);
    },
    error: (error) => {
      const message = this.errorService.handle(error);
      this.notificationService.error('Error', message);
      this.isLoading.set(false);
    }
  });
```

**Regla:** 
- Siempre incluir `error` handler en `subscribe()`
- Usar `takeUntilDestroyed()` para evitar memory leaks
- Usar `finalize()` para limpiar estados de loading
- Usar `HttpErrorService` para manejar errores de forma consistente

---

### 7. Actualización Sincronizada de Estados Relacionados

**❌ ERROR COMÚN:**
```typescript
// ❌ INCORRECTO: Actualizar solo un estado, olvidar otros relacionados
handleApprove(): void {
  this.quoteService.approveQuote(id).subscribe({
    next: (quote) => {
      this.quote.set(quote);
      // ❌ Olvida resetear isProcessing en el componente hijo
    }
  });
}
```

**✅ SOLUCIÓN CORRECTA:**
```typescript
// ✅ CORRECTO: El componente hijo se auto-resetea cuando cambia el quote
// En QuoteApprovalActionsComponent:
constructor() {
  effect(() => {
    const quote = this.quote;
    if (quote && this.isProcessing()) {
      setTimeout(() => this.isProcessing.set(false), 100);
    }
  });
}

// O usar finalize en el observable
handleApprove(): void {
  this.quoteService.approveQuote(id)
    .pipe(
      takeUntilDestroyed(),
      finalize(() => {
        // Resetear estados relacionados si es necesario
      })
    )
    .subscribe({
      next: (quote) => {
        this.quote.set(quote);
      }
    });
}
```

**Regla:** Cuando un componente hijo tiene estado de procesamiento, debe resetearse automáticamente cuando cambian los datos del padre (usando `effect()`) o usar `finalize()` en el observable.

---

### 8. Conflictos de Nombres en Templates (Variables Locales vs Signals)

**❌ ERROR COMÚN:**
```html
<!-- ❌ INCORRECTO: La variable local 'quote' oculta el signal 'quote' -->
@else if (quote(); as quote) {
  <div>{{ quote.category }}</div>
  <!-- Más adelante... -->
  @if (quote()?.status === 'rejected') { <!-- ❌ ERROR: quote no es callable -->
    ...
  }
}
```

**✅ SOLUCIÓN CORRECTA:**
```html
<!-- ✅ CORRECTO: Usar un nombre diferente para la variable local -->
@else if (quote(); as currentQuote) {
  <div>{{ currentQuote.category }}</div>
  <!-- O usar el signal directamente si necesitas reactividad -->
  @if (quote()?.status === 'rejected') {
    ...
  }
}
```

**Regla:** 
- Cuando uses `@if (signal(); as variableName)`, usa un nombre diferente al del signal para evitar conflictos
- Si necesitas reactividad dentro del bloque, usa `signal()` directamente
- Si solo necesitas el valor una vez, usa la variable local del `@if`

---

## 📋 Checklist de Implementación

Cuando implementes una nueva funcionalidad relacionada con estados o flujos de aprobación:

- [ ] ¿Actualicé el tipo `QuoteStatus` si agregué un nuevo estado?
- [ ] ¿Actualicé `statusOptions` en TODOS los formularios?
- [ ] ¿Actualicé `getStatusColor()` en TODOS los componentes de visualización?
- [ ] ¿Validé las transiciones de estado según el flujo documentado?
- [ ] ¿Agregué manejo de errores en TODOS los observables?
- [ ] ¿Usé `takeUntilDestroyed()` en todos los observables?
- [ ] ¿Reseteo estados de procesamiento (`isProcessing`, `isLoading`) en `finalize()` o `effect()`?
- [ ] ¿Validé campos obligatorios (como `rejectionComments.comment`)?
- [ ] ¿Actualicé la documentación de la API si cambié el backend?

---

## 🔍 Lugares Críticos a Revisar

Cuando agregues o modifiques estados de Quote, revisa estos archivos:

1. **Modelos:**
   - `src/app/core/models/quote.model.ts` - `QuoteStatus` type

2. **Formularios:**
   - `src/app/features/quotes/ui/kitchen-quote-form/kitchen-quote-form.component.ts`
   - `src/app/features/quotes/ui/kitchen-quote-form/tabs/project-data-tab/project-data-tab.component.ts`
   - `src/app/features/quotes/ui/additional-work-quote-form/additional-work-quote-form.component.ts`

3. **Componentes de Visualización:**
   - `src/app/pages/quote-detail/quote-detail.page.ts` - `getStatusColor()`
   - `src/app/pages/quotes/quotes.page.ts` - `getStatusColor()`
   - `src/app/features/quotes/ui/quote-list/quote-list.component.ts` - `getStatusColor()`

4. **Servicios:**
   - `src/app/core/services/quote/quote.service.ts` - Métodos de aprobación/rechazo

---

## 🎯 Principios Fundamentales

1. **Consistencia:** Si cambias un estado en un lugar, cámbialo en TODOS los lugares relacionados
2. **Validación:** Siempre valida transiciones de estado y campos obligatorios
3. **Manejo de Errores:** Nunca dejes observables sin manejo de errores
4. **Limpieza de Estado:** Siempre resetea estados de procesamiento/loading
5. **Type Safety:** Usa tipos estrictos, nunca `any`
6. **Documentación:** Actualiza la documentación cuando cambies el comportamiento

---

**Última actualización:** 25 de Enero de 2026
**Contexto:** Flujo de cotizaciones: DRAFT (Save as Draft) → SENT (Submit) → APPROVED/REJECTED (Customer) → IN_PROGRESS → COMPLETED
**IMPORTANTE:** PENDING NO EXISTE - es igual a DRAFT. Solo usar DRAFT.
