# Cambios Requeridos en el Backend para Audit Log

## 📋 Resumen

Para implementar la funcionalidad de **Controlled Editing + Audit Log**, se necesitan los siguientes cambios en el backend (NestJS):

---

## 🆕 Nuevos Módulos y Endpoints

### 1. **Módulo de Audit Log** (NUEVO)

#### Schema de Audit Log

**Archivo**: `src/modules/audit-log/schemas/audit-log.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AuditLog extends Document {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'Quote' })
  quoteId: Types.ObjectId;

  @Prop({ required: true })
  field: string; // Ej: "totalPrice", "kitchenInformation.countertopsFiles"

  @Prop({ type: mongoose.Schema.Types.Mixed })
  oldValue: unknown;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  newValue: unknown;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  changedBy: Types.ObjectId;

  @Prop()
  changedByName?: string; // Para display rápido

  @Prop()
  reason?: string; // Razón del cambio (opcional pero recomendado)

  @Prop({ required: true })
  statusBefore: string; // Estado antes del cambio

  @Prop({ required: true })
  statusAfter: string; // Estado después del cambio
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Índices para búsquedas eficientes
AuditLogSchema.index({ quoteId: 1, createdAt: -1 });
AuditLogSchema.index({ changedBy: 1 });
```

#### DTOs

**Archivo**: `src/modules/audit-log/dto/create-audit-log.dto.ts`

```typescript
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  @IsNotEmpty()
  field: string;

  @IsObject()
  @IsOptional()
  oldValue?: unknown;

  @IsObject()
  @IsOptional()
  newValue?: unknown;

  @IsString()
  @IsOptional()
  reason?: string;
}
```

#### Servicio

**Archivo**: `src/modules/audit-log/audit-log.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { Quote } from '../quote/schemas/quote.schema';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>,
  ) {}

  async createEntry(
    quoteId: string,
    data: CreateAuditLogDto,
    userId: string,
    statusBefore: string,
    statusAfter: string,
  ): Promise<AuditLog> {
    const entry = new this.auditLogModel({
      quoteId,
      ...data,
      changedBy: userId,
      statusBefore,
      statusAfter,
    });
    return entry.save();
  }

  async getQuoteAuditLog(quoteId: string): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ quoteId })
      .populate('changedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Compara dos quotes y crea entradas de audit log para los campos que cambiaron
   */
  async trackQuoteUpdate(
    quoteId: string,
    oldQuote: Quote,
    newQuote: Quote,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const changes = this.compareQuotes(oldQuote, newQuote);
    
    for (const change of changes) {
      await this.createEntry(
        quoteId,
        {
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          reason,
        },
        userId,
        oldQuote.status,
        newQuote.status,
      );
    }
  }

  /**
   * Compara dos quotes y retorna lista de cambios
   */
  private compareQuotes(oldQuote: Quote, newQuote: Quote): Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }> {
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    // Comparar campos directos
    const directFields = ['totalPrice', 'notes', 'status', 'experience'];
    for (const field of directFields) {
      if (oldQuote[field] !== newQuote[field]) {
        changes.push({
          field,
          oldValue: oldQuote[field],
          newValue: newQuote[field],
        });
      }
    }

    // Comparar objetos anidados (kitchenInformation, etc.)
    const nestedObjects = ['kitchenInformation', 'bathroomInformation', 'basementInformation', 'additionalWorkInformation'];
    for (const objKey of nestedObjects) {
      if (oldQuote[objKey] || newQuote[objKey]) {
        const nestedChanges = this.compareNestedObject(
          oldQuote[objKey] || {},
          newQuote[objKey] || {},
          objKey,
        );
        changes.push(...nestedChanges);
      }
    }

    // Comparar materials
    if (JSON.stringify(oldQuote.materials) !== JSON.stringify(newQuote.materials)) {
      changes.push({
        field: 'materials',
        oldValue: oldQuote.materials,
        newValue: newQuote.materials,
      });
    }

    return changes;
  }

  private compareNestedObject(
    oldObj: Record<string, unknown>,
    newObj: Record<string, unknown>,
    prefix: string,
  ): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const fieldPath = `${prefix}.${key}`;
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: fieldPath,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    }

    return changes;
  }
}
```

#### Controlador

**Archivo**: `src/modules/audit-log/audit-log.controller.ts`

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('quote/:quoteId/audit-log')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getAuditLog(@Param('quoteId') quoteId: string) {
    return this.auditLogService.getQuoteAuditLog(quoteId);
  }

  @Post()
  async createEntry(
    @Param('quoteId') quoteId: string,
    @Body() dto: CreateAuditLogDto,
    @CurrentUser() user: { id: string },
  ) {
    // Obtener quote actual para statusBefore/statusAfter
    // Esto requiere inyectar QuoteService
    // Por ahora, se puede hacer en el servicio
    return this.auditLogService.createEntry(
      quoteId,
      dto,
      user.id,
      'sent', // statusBefore - obtener del quote
      'sent', // statusAfter - obtener del quote
    );
  }
}
```

#### Módulo

**Archivo**: `src/modules/audit-log/audit-log.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { QuoteModule } from '../quote/quote.module'; // Para usar QuoteService si es necesario

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
    QuoteModule,
  ],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService], // Exportar para usar en QuoteModule
})
export class AuditLogModule {}
```

---

## 🔄 Modificaciones en Módulo Existente (Quote)

### 1. **Modificar QuoteService**

**Archivo**: `src/modules/quote/quote.service.ts`

#### Agregar validación de permisos para override

```typescript
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class QuoteService {
  constructor(
    // ... otros servicios
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Valida si un usuario puede hacer override en una cotización
   */
  private canOverride(user: User, quote: Quote): boolean {
    const userRole = user.role?.toLowerCase();
    
    // Admin siempre puede
    if (userRole === 'admin' || userRole === 'administrator') {
      return true;
    }
    
    // Estimator puede si es el creador o tiene permisos
    if (userRole === 'estimator') {
      return quote.userId.toString() === user._id.toString();
    }
    
    return false;
  }

  /**
   * Actualiza una cotización con registro de cambios en audit log
   */
  async updateQuote(
    id: string,
    updateData: Partial<Quote>,
    userId: string,
    reason?: string,
  ): Promise<Quote> {
    // Obtener quote actual
    const oldQuote = await this.quoteModel.findById(id).exec();
    if (!oldQuote) {
      throw new NotFoundException('Quote not found');
    }

    // Si está en estado 'sent', validar permisos de override
    if (oldQuote.status === 'sent') {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !this.canOverride(user, oldQuote)) {
        throw new ForbiddenException('No tiene permisos para editar esta cotización en estado "sent"');
      }
      
      // Si no hay razón, requerirla
      if (!reason || reason.trim() === '') {
        throw new BadRequestException('Se requiere una razón para editar una cotización en estado "sent"');
      }
    }

    // Actualizar quote
    const updatedQuote = await this.quoteModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    // Registrar cambios en audit log
    if (oldQuote.status === 'sent') {
      await this.auditLogService.trackQuoteUpdate(
        id,
        oldQuote,
        updatedQuote,
        userId,
        reason,
      );
    }

    return updatedQuote;
  }
}
```

### 2. **Nuevo Endpoint para Override**

**Archivo**: `src/modules/quote/quote.controller.ts`

```typescript
@Patch(':id/override')
@UseGuards(JwtAuthGuard)
async overrideQuote(
  @Param('id') id: string,
  @Body() updateData: UpdateQuoteDto & { reason: string }, // Requiere razón
  @CurrentUser() user: { id: string },
) {
  const { reason, ...quoteData } = updateData;
  
  if (!reason || reason.trim() === '') {
    throw new BadRequestException('Se requiere una razón para hacer override');
  }

  return this.quoteService.updateQuote(id, quoteData, user.id, reason);
}
```

### 3. **Modificar QuoteModule**

**Archivo**: `src/modules/quote/quote.module.ts`

```typescript
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    // ... otros imports
    AuditLogModule, // Agregar para usar AuditLogService
  ],
  // ...
})
export class QuoteModule {}
```

---

## 📝 DTOs Adicionales

### UpdateQuoteDto con razón

**Archivo**: `src/modules/quote/dto/update-quote.dto.ts`

```typescript
import { IsString, IsOptional } from 'class-validator';

export class UpdateQuoteDto {
  // ... campos existentes del DTO
  
  @IsString()
  @IsOptional()
  reason?: string; // Razón para override (requerida si status es 'sent')
}
```

---

## 🔍 Endpoints Nuevos/Modificados

### Nuevos Endpoints

1. **GET `/quote/:quoteId/audit-log`**
   - Obtiene el historial completo de cambios de una cotización
   - Requiere autenticación
   - Retorna array de `AuditLogEntry`

2. **POST `/quote/:quoteId/audit-log`**
   - Crea una entrada manual en el audit log
   - Requiere autenticación
   - Body: `CreateAuditLogDto`

3. **PATCH `/quote/:id/override`**
   - Endpoint especial para hacer override de una cotización en estado 'sent'
   - Requiere autenticación y permisos (admin/estimator)
   - Body: `UpdateQuoteDto` + `reason` (requerido)
   - Valida permisos y registra cambios automáticamente

### Endpoints Modificados

1. **PATCH `/quote/:id`**
   - Modificar para validar permisos si status es 'sent'
   - Si status es 'sent' y se hacen cambios, registrar en audit log
   - Opcionalmente requerir `reason` en el body si status es 'sent'

---

## ✅ Checklist de Implementación Backend

- [ ] Crear schema `AuditLog` con todos los campos necesarios
- [ ] Crear `AuditLogModule` con servicio y controlador
- [ ] Implementar `AuditLogService` con métodos:
  - [ ] `createEntry()` - Crear entrada individual
  - [ ] `getQuoteAuditLog()` - Obtener historial de una cotización
  - [ ] `trackQuoteUpdate()` - Comparar y registrar cambios automáticamente
  - [ ] `compareQuotes()` - Comparar dos quotes y detectar cambios
- [ ] Modificar `QuoteService.updateQuote()` para:
  - [ ] Validar permisos si status es 'sent'
  - [ ] Requerir razón si status es 'sent'
  - [ ] Llamar a `auditLogService.trackQuoteUpdate()` después de actualizar
- [ ] Agregar endpoint `PATCH /quote/:id/override` en `QuoteController`
- [ ] Modificar `PATCH /quote/:id` para validar permisos de override
- [ ] Agregar índices en MongoDB para búsquedas eficientes
- [ ] Agregar validaciones con class-validator en DTOs
- [ ] Agregar tests unitarios para `AuditLogService`
- [ ] Agregar tests de integración para endpoints

---

## 🔐 Consideraciones de Seguridad

1. **Validación de Permisos:**
   - Solo admin y estimator pueden hacer override
   - Estimator solo puede hacer override en sus propias cotizaciones
   - Customer nunca puede hacer override

2. **Validación de Razón:**
   - Requerir razón cuando se hace override (no puede estar vacía)
   - Validar longitud mínima/máxima de razón

3. **Inmutabilidad del Audit Log:**
   - Las entradas de audit log NO deben poder editarse ni eliminarse
   - Solo lectura para todos los usuarios

4. **Rate Limiting:**
   - Considerar rate limiting en endpoints de override para prevenir abusos

---

## 📊 Consideraciones de Performance

1. **Índices:**
   - Índice en `quoteId` y `createdAt` para búsquedas rápidas
   - Índice en `changedBy` para filtrar por usuario

2. **Paginación:**
   - Implementar paginación en `GET /quote/:quoteId/audit-log` si hay muchos cambios

3. **Comparación Eficiente:**
   - Optimizar `compareQuotes()` para no hacer comparaciones innecesarias
   - Considerar usar deep-diff library para comparaciones más eficientes

---

## 🧪 Testing

### Tests Unitarios

```typescript
describe('AuditLogService', () => {
  it('should create audit log entry', async () => { });
  it('should track quote updates correctly', async () => { });
  it('should compare quotes and detect changes', async () => { });
});

describe('QuoteService - Override', () => {
  it('should allow admin to override sent quote', async () => { });
  it('should allow estimator to override own sent quote', async () => { });
  it('should reject customer override attempt', async () => { });
  it('should require reason for override', async () => { });
  it('should create audit log entries on override', async () => { });
});
```

---

## 📚 Documentación de API

Agregar a `API_DOCUMENTATION.md`:

```markdown
## Audit Log

### GET `/quote/:quoteId/audit-log`

Obtiene el historial completo de cambios de una cotización.

**Autenticación**: Requerida

**Respuesta exitosa** (200):
```json
[
  {
    "_id": "audit_log_id",
    "quoteId": "quote_id",
    "field": "totalPrice",
    "oldValue": 50000,
    "newValue": 55000,
    "changedBy": "user_id",
    "changedByName": "Juan Pérez",
    "reason": "Ajuste por cambio en materiales",
    "statusBefore": "sent",
    "statusAfter": "sent",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

### PATCH `/quote/:id/override`

Permite editar una cotización en estado 'sent' con registro de cambios.

**Autenticación**: Requerida
**Permisos**: Admin o Estimator (solo en sus propias cotizaciones)

**Body**:
```json
{
  "totalPrice": 55000,
  "reason": "Ajuste por cambio en materiales" // REQUERIDO
}
```

**Validaciones**:
- La cotización debe estar en estado 'sent'
- El usuario debe tener permisos (admin/estimator)
- El campo `reason` es obligatorio
```

---

## 🚀 Orden de Implementación Recomendado

1. **Fase 1: Infraestructura Base**
   - Crear schema `AuditLog`
   - Crear `AuditLogModule` básico
   - Implementar `AuditLogService.createEntry()` y `getQuoteAuditLog()`

2. **Fase 2: Lógica de Comparación**
   - Implementar `compareQuotes()` y `trackQuoteUpdate()`
   - Agregar tests para comparación

3. **Fase 3: Integración con Quote**
   - Modificar `QuoteService.updateQuote()` para validar permisos
   - Agregar endpoint `PATCH /quote/:id/override`
   - Integrar registro automático de cambios

4. **Fase 4: Endpoints y Documentación**
   - Agregar endpoints de audit log
   - Documentar en `API_DOCUMENTATION.md`
   - Agregar tests de integración
