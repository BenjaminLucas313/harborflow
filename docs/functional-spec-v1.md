# Functional Specification V1
## HarborFlow — Sistema de Reservas de Lanchas

---

## 1. Overview

### 1.1 Nombre del sistema
**HarborFlow** (provisional)

### 1.2 Tipo de producto
Plataforma web multiempresa/multisucursal para gestión de reservas y operación de transporte en lanchas.

### 1.3 Objetivo
Centralizar la operación de reservas, embarque y control operativo de viajes, asegurando:
- integridad de reservas
- control de capacidad
- experiencia clara para usuarios
- herramientas operativas para personal
- métricas útiles para administración

### 1.4 Alcance del documento
Define el comportamiento funcional del sistema en su versión MVP (V1).

---

## 2. Alcance del MVP

### 2.1 Incluye
- autenticación de usuarios
- roles: usuario, operador, administrador
- modelo multiempresa (backend-ready)
- modelo multisucursal (backend-ready)
- gestión de lanchas
- gestión de choferes
- gestión de viajes
- reservas
- reemplazo de reservas
- lista de espera
- check-in
- cierre de puerto
- avisos operativos
- tablero básico de operación
- métricas operativas iniciales

### 2.2 Excluye
- pagos online
- app mobile nativa
- integraciones externas complejas
- automatizaciones avanzadas
- notificaciones multicanal complejas
- analítica histórica avanzada

---

## 3. Roles y Permisos

| Acción / Recurso        | Usuario | Operador | Admin |
|------------------------|--------|----------|-------|
| Registrarse            | ✅     | ❌       | ❌    |
| Reservar               | ✅     | ❌       | ❌    |
| Reemplazar reserva     | ✅     | ❌       | ❌    |
| Ver viajes             | ✅     | ✅       | ✅    |
| Ver reservas           | ⚠️ propia | ✅     | ✅    |
| Check-in               | ❌     | ✅       | ✅    |
| Crear/editar viajes    | ❌     | ⚠️ opcional | ✅ |
| Gestionar lanchas      | ❌     | ❌       | ✅    |
| Gestionar choferes     | ❌     | ❌       | ✅    |
| Cerrar puerto          | ❌     | ✅       | ✅    |
| Publicar avisos        | ❌     | ✅       | ✅    |
| Ver métricas           | ❌     | ❌       | ✅    |

---

## 4. Modelo de Dominio

### 4.1 Entidades principales

| Entidad            | Descripción |
|-------------------|------------|
| Company           | Empresa operadora |
| Branch            | Sucursal / puerto |
| User              | Usuario del sistema |
| Role              | Rol del usuario |
| Boat              | Lancha |
| Driver            | Chofer |
| Trip              | Salida programada |
| Reservation       | Reserva |
| WaitlistEntry     | Lista de espera |
| PortStatus        | Estado del puerto |
| OperationalNotice | Aviso visible |
| CheckIn           | Registro de embarque |
| AuditLog          | Historial |

---

## 5. Estados del Sistema

### 5.1 PortStatus

| Estado |
|--------|
| OPEN |
| PARTIALLY_OPEN |
| CLOSED_WEATHER |
| CLOSED_MAINTENANCE |
| CLOSED_SECURITY |
| CLOSED_OTHER |

### 5.2 TripStatus

| Estado |
|--------|
| SCHEDULED |
| BOARDING |
| FULL |
| DELAYED |
| CANCELLED |
| DEPARTED |
| COMPLETED |

### 5.3 ReservationStatus

| Estado |
|--------|
| CONFIRMED |
| WAITLISTED |
| REPLACED |
| CANCELLED |
| CHECKED_IN |
| NO_SHOW |

---

## 6. Reglas de Negocio

### 6.1 Reserva activa única
Un usuario solo puede tener una reserva activa.

### 6.2 Reemplazo de reserva
- debe ser explícito
- cancela o reemplaza la anterior
- genera nueva reserva
- registra auditoría

### 6.3 Capacidad
- nunca se puede sobrepasar
- validación server-side obligatoria

### 6.4 Lista de espera
- orden FIFO
- promoción determinística
- sin duplicados

### 6.5 Elegibilidad
Antes de reservar:
- usuario autenticado
- viaje disponible
- puerto habilitado
- sin reserva activa conflictiva
- capacidad o waitlist disponible

### 6.6 Cierre de puerto
- bloquea reservas
- muestra aviso visible
- mensaje editable
- incluye motivo y reapertura estimada

### 6.7 Check-in
- solo para reservas válidas
- registra estado
- impacta métricas

### 6.8 Auditoría
Toda acción crítica debe registrarse.

---

## 7. Flujos Principales

### 7.1 Reserva normal
1. usuario selecciona viaje
2. sistema valida
3. confirma reserva

### 7.2 Reemplazo
1. usuario selecciona nueva salida
2. sistema detecta reserva activa
3. solicita confirmación
4. ejecuta reemplazo

### 7.3 Lista de espera
1. viaje lleno
2. usuario entra en waitlist
3. sistema registra

### 7.4 Check-in
1. operador abre viaje
2. valida pasajero
3. registra presencia

### 7.5 Cierre de puerto
1. operador activa cierre
2. escribe mensaje
3. sistema bloquea reservas
4. muestra aviso global

---

## 8. UX/UI

### Principios
- mobile-first
- claridad extrema
- mensajes grandes
- mínima fricción
- feedback inmediato

### Requisitos
- botones grandes
- mensajes claros
- estados visibles
- aviso de cierre dominante
- navegación simple

---

## 9. Métricas del MVP

| Métrica |
|--------|
| ocupación por viaje |
| ocupación por lancha |
| ocupación por horario |
| reservas del día |
| lista de espera |
| no-show |
| cancelaciones |
| viajes llenos |
| viajes vacíos |
| impacto de cierres |

---

## 10. Arquitectura Funcional

- multiempresa desde base
- multisucursal desde base
- lógica crítica en backend
- validaciones estrictas
- escalable
- modular

---

## 11. Riesgos Controlados

- sobreventa
- doble reserva
- waitlist incorrecta
- check-in inválido
- fuga de datos
- mala comunicación de estado

---

## 12. Definición de Done

El MVP está completo cuando:
- reservas funcionan correctamente
- no hay sobreventa
- reemplazo funciona
- waitlist funciona
- check-in funciona
- cierre de puerto funciona
- roles funcionan
- métricas básicas disponibles
- UI clara

---

## 13. Decisiones Pendientes

- definición exacta de “reserva activa”
- política de no_show
- tiempos de check-in
- comportamiento ante reapertura de puerto
- notificaciones automáticas
- límites de reserva por tiempo