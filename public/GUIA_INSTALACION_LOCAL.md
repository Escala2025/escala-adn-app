# GUÍA DE INSTALACIÓN LOCAL — ESCALA ADN
### Paso a paso exageradamente detallado para ejecutar la plataforma en tu computador

---

## ÍNDICE
1. Requisitos previos
2. Descomprimir el proyecto
3. Abrir en Visual Studio Code
4. Instalar dependencias del Frontend (Next.js)
5. Configurar y crear la base de datos PostgreSQL
6. Configurar el Backend PHP
7. Ejecutar la plataforma localmente
8. Credenciales de acceso y roles del sistema
9. Solución de problemas frecuentes
10. Estructura completa del proyecto
11. Integración con Google Drive (adjuntos de cuentas de cobro)

---

## TABLA DE ROLES Y PERMISOS

Esta es la referencia rápida de qué puede hacer cada rol en la plataforma:

| Módulo | CEO | TI | Contable | Personal Base | Proveedor |
|--------|-----|----|----------|---------------|-----------|
| Dashboard | Ver | Ver | Ver | No | No |
| Usuarios y Roles | Ver + Editar | Ver + Editar | No | No | No |
| Gestor de Contraseñas | **Todas** las contraseñas | Todas **excepto CEO** | Solo las propias | Solo las propias | No |
| Proveedores | Ver + Editar | Ver + Editar | Ver + Editar | No | No |
| Cuentas de Cobro | **Tablero completo** + Aprobar/Rechazar | Solo su propia cuenta | **Tablero completo** + Aprobar/Rechazar | Solo su propia cuenta | Solo su propia cuenta |
| Mis Pagos | Ver los suyos | Ver los suyos | Ver los suyos | Ver los suyos | Ver los suyos |

> **Regla clave:** Solo CEO y Contable pueden aprobar o rechazar cuentas de cobro.
> TI puede subir su propia cuenta de cobro pero no ve las de los demás.

---

## PARTE 1 — REQUISITOS PREVIOS

Antes de comenzar, instala en tu computador los siguientes programas.
Descarga e instala **en este orden**:

### 1.1 Node.js (versión 20 o superior)
- Ve a: https://nodejs.org/es/
- Descarga la versión **LTS** (Long Term Support)
- Ejecuta el instalador y acepta todas las opciones por defecto
- **Verificar instalación**: Abre una terminal y escribe:
  ```
  node --version
  ```
  Debe mostrar algo como: `v20.x.x`
  ```
  npm --version
  ```
  Debe mostrar algo como: `10.x.x`

### 1.2 Visual Studio Code
- Ve a: https://code.visualstudio.com/
- Descarga la versión para tu sistema operativo (Windows / Mac / Linux)
- Instala con todas las opciones por defecto

### 1.3 PostgreSQL (base de datos)
- Ve a: https://www.postgresql.org/download/
- Descarga la versión **16** para tu sistema operativo
- Durante la instalación:
  - Anota bien la **contraseña del superusuario (postgres)** que te pide
  - El puerto por defecto es **5432** — déjalo así
  - Instala también **pgAdmin 4** cuando te lo ofrezca (viene incluido)
- **Verificar instalación**: Busca "pgAdmin 4" en tus programas y ábrelo

### 1.4 PHP (versión 8.2 o superior) + Servidor Local
**Opción recomendada para Windows: Laragon**
- Ve a: https://laragon.org/download/
- Descarga **Laragon Full**
- Instala con todas las opciones por defecto
- Laragon incluye PHP 8.2, Apache y una interfaz fácil de usar

**Opción para Mac: MAMP**
- Ve a: https://www.mamp.info/
- Descarga **MAMP** (versión gratuita)
- Instala con opciones por defecto

**Opción para Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install php8.2 php8.2-pgsql php8.2-mbstring php8.2-json php8.2-curl apache2 -y
```

### 1.5 Git (opcional pero recomendado)
- Ve a: https://git-scm.com/downloads
- Instala con opciones por defecto

---

## PARTE 2 — DESCOMPRIMIR EL PROYECTO

### 2.1 Ubica el archivo ZIP descargado
El archivo se llama algo como: `escala-adn-v1.zip`
Búscalo en tu carpeta de **Descargas**.

### 2.2 Descomprimir (Windows)
1. Haz **clic derecho** sobre el archivo ZIP
2. Selecciona **"Extraer todo..."**
3. Elige la ruta donde quieres guardar el proyecto. **Recomendado:**
   - Windows: `C:\proyectos\escala-adn\`
   - Mac/Linux: `~/proyectos/escala-adn/`
4. Haz clic en **"Extraer"**

### 2.3 Descomprimir (Mac)
1. Haz **doble clic** sobre el archivo ZIP
2. Se creará automáticamente una carpeta con el proyecto
3. Mueve esa carpeta a tu escritorio o a `~/proyectos/escala-adn/`

### 2.4 Estructura que debes ver después de descomprimir
```
escala-adn/
├── frontend/           ← Código Next.js (Angular está descrito como Next.js en este proyecto)
│   ├── app/
│   │   ├── page.tsx    ← Aplicación completa
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── public/
│   ├── package.json
│   └── ...
├── backend/            ← Código PHP
│   ├── api/
│   ├── config/
│   └── ...
└── scripts/
    └── escala_adn_database.sql   ← Script de base de datos
```

---

## PARTE 3 — ABRIR EN VISUAL STUDIO CODE

### 3.1 Abrir la carpeta del proyecto
**Opción A — Desde Visual Studio Code:**
1. Abre Visual Studio Code
2. Ve al menú **Archivo** → **Abrir carpeta...**
3. Navega hasta donde descomprimiste el proyecto (ej: `C:\proyectos\escala-adn\`)
4. Selecciona la carpeta y haz clic en **"Seleccionar carpeta"**

**Opción B — Desde la terminal:**
```bash
# Navega hasta la carpeta del proyecto
cd C:\proyectos\escala-adn      # Windows
cd ~/proyectos/escala-adn        # Mac/Linux

# Abre VS Code en esa carpeta
code .
```

### 3.2 Instalar extensiones recomendadas de VS Code
Cuando VS Code abra el proyecto, puede que aparezca una notificación preguntando si quieres instalar las extensiones recomendadas. Haz clic en **"Instalar"**.

Si no aparece, instala manualmente estas extensiones (Ctrl+Shift+X):
- **ESLint** — Análisis de código JavaScript/TypeScript
- **Prettier** — Formateo de código
- **PHP Intelephense** — Soporte para PHP
- **Tailwind CSS IntelliSense** — Autocompletado de clases Tailwind
- **Thunder Client** — Para probar la API (alternativa a Postman)

### 3.3 Abrir la terminal integrada de VS Code
- Presiona `Ctrl + `` ` (tecla de acento grave, arriba del Tab)
- O ve al menú **Terminal** → **Nueva terminal**
- Verifica que la ruta en la terminal muestre la carpeta del proyecto

---

## PARTE 4 — INSTALAR DEPENDENCIAS DEL FRONTEND

### 4.1 Navegar a la carpeta del frontend
En la terminal integrada de VS Code:
```bash
cd frontend
```
Si ya estás en la carpeta raíz del proyecto, este comando te lleva al frontend.

### 4.2 Instalar todos los paquetes de Node.js

Ejecuta este comando exactamente como aparece. **No agregues ninguna bandera adicional**
(en especial no uses `--production` ni `--only=prod` porque eso omite paquetes críticos de CSS):

```bash
npm install
```

Este proceso puede tardar entre **2 y 8 minutos** dependiendo de tu conexión a internet.
Cuando termine, debes ver algo como:
```
added 847 packages in 3m
```

> **Si ves advertencias (warnings en amarillo)** — son normales, no hacen nada.
> Solo los errores en rojo son un problema.
> **Si ves `added 0 packages`** — la instalación no funcionó, repite el comando.

### 4.3 Verificar que los paquetes de Tailwind CSS están instalados

Este es el paso que más usuarios se saltan y es la causa número 1 de la pantalla sin estilos.
Ejecuta el siguiente comando para confirmar que Tailwind CSS está disponible:

En Windows:
```
dir node_modules\@tailwindcss\postcss
```

En Mac o Linux:
```bash
ls node_modules/@tailwindcss/postcss
```

Debe listar archivos dentro de esa carpeta. Si dice "No se puede encontrar" o
"No such file or directory", ejecuta:
```bash
npm install @tailwindcss/postcss tailwindcss --save
```

### 4.4 Verificar que la instalación fue exitosa
```bash
npm run dev
```
Si todo salió bien, verás:
```
▲ Next.js 16.x.x
- Local:   http://localhost:3000
✓ Ready in 1.2s
```
Abre tu navegador y ve a **http://localhost:3000**

Debes ver la pantalla de login de Escala ADN con el diseño corporativo completo:
fondo en tonos arena/beige, formulario centrado con tarjeta blanca, logotipo
y colores verde azulado institucional. Si ves una pantalla sin estilos (HTML plano),
ve directamente a la sección 9 — "La aplicación abre pero SIN estilos".

Presiona `Ctrl + C` en la terminal para detener el servidor (lo arrancaremos de
nuevo después de configurar la base de datos).

---

## PARTE 5 — CREAR LA BASE DE DATOS POSTGRESQL

Este es el paso más importante. Aquí creamos todas las tablas de la plataforma.

### 5.1 Abrir pgAdmin 4
1. Busca **pgAdmin 4** en el menú de inicio de Windows (o en Aplicaciones en Mac)
2. Se abrirá en tu navegador web (generalmente en http://127.0.0.1:5050)
3. Te pedirá una **contraseña maestra** — es la que pusiste durante la instalación de PostgreSQL

### 5.2 Conectar al servidor PostgreSQL
1. En el panel izquierdo, verás **"Servers"**
2. Haz clic en la flecha para expandirlo
3. Verás **"PostgreSQL 16"** (o la versión que instalaste)
4. Haz doble clic y te pedirá la contraseña del usuario `postgres`
   - Ingresa la contraseña que definiste durante la instalación
   - Marca "Save Password" para no tener que ingresarla cada vez

### 5.3 Crear la base de datos
1. Haz **clic derecho** sobre **"Databases"** (dentro de PostgreSQL 16)
2. Selecciona **"Create"** → **"Database..."**
3. En el campo **"Database"** escribe exactamente: `escala_adn`
4. En **"Owner"** selecciona `postgres`
5. Haz clic en **"Save"**
6. Verás que apareció `escala_adn` en la lista de bases de datos

### 5.4 Abrir el Query Tool (Herramienta de consultas)
1. Haz **clic derecho** sobre la base de datos `escala_adn`
2. Selecciona **"Query Tool"**
3. Se abrirá un editor de SQL en la parte derecha

### 5.5 Cargar y ejecutar el script SQL
**Opción A — Copiar y pegar:**
1. En VS Code, abre el archivo `scripts/escala_adn_database.sql`
2. Selecciona **todo el contenido** (`Ctrl + A`)
3. Cópialo (`Ctrl + C`)
4. Ve a pgAdmin y pégalo en el Query Tool (`Ctrl + V`)
5. Haz clic en el botón **"Execute/Run"** (ícono de triángulo de reproducción) o presiona `F5`

**Opción B — Abrir el archivo directamente:**
1. En pgAdmin, en el Query Tool, ve a **File** → **Open File...**
2. Navega hasta `scripts/escala_adn_database.sql`
3. Selecciónalo y haz clic en **"Open"**
4. Presiona `F5` para ejecutar

### 5.6 Verificar que el script se ejecutó correctamente
En la parte inferior del Query Tool verás el panel de mensajes.
Debes ver algo como:
```
Query returned successfully in 450 msec.
```
Si ves errores en rojo, lee la sección de solución de problemas al final de esta guía.

### 5.7 Verificar las tablas creadas
1. En el panel izquierdo, expande: `escala_adn` → `Schemas` → `public` → `Tables`
2. Debes ver estas tablas:
   - `roles`
   - `usuarios`
   - `sesiones_jwt`
   - `gestor_contrasenas`
   - `proveedores`
   - `transacciones_proveedores`
   - `cuentas_cobro`
   - `auditoria_acciones`
   - `notificaciones`

Si ves todas estas tablas, ¡la base de datos está lista!

---

## PARTE 6 — CONFIGURAR EL BACKEND PHP

### 6.1 Copiar los archivos del backend al servidor local

**En Windows con Laragon:**
1. Abre Laragon y haz clic en **"Start All"**
2. Copia la carpeta `backend/` del proyecto a:
   ```
   C:\laragon\www\escala-adn\
   ```
   (Puedes arrastrar y soltar desde el Explorador de archivos)

**En Mac con MAMP:**
1. Abre MAMP y haz clic en **"Start Servers"**
2. Copia la carpeta `backend/` a:
   ```
   /Applications/MAMP/htdocs/escala-adn/
   ```

### 6.2 Configurar la conexión a la base de datos
1. Abre el archivo `backend/config/base_de_datos.php` en VS Code
2. Busca estas líneas y ajusta los valores según tu instalación:

```php
// Parámetros de conexión a PostgreSQL
define('DB_HOST',     'localhost');  // No cambiar
define('DB_PORT',     '5432');       // No cambiar si usaste el puerto por defecto
define('DB_NOMBRE',   'escala_adn'); // El nombre que diste a la base de datos
define('DB_USUARIO',  'postgres');   // El usuario de PostgreSQL
define('DB_CONTRASENA', 'TU_CONTRASENA_AQUI'); // ← CAMBIA ESTO por tu contraseña de PostgreSQL
```

3. Guarda el archivo (`Ctrl + S`)

### 6.3 Configurar las variables de entorno del backend
1. En la carpeta `backend/`, busca el archivo `.env.example`
2. Copia ese archivo y renómbralo a `.env`
   - Windows: En el Explorador, copia y pega, luego renombra
   - Terminal: `cp .env.example .env`
3. Abre `.env` en VS Code y configura:
```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NOMBRE=escala_adn
DB_USUARIO=postgres
DB_CONTRASENA=tu_contraseña_aqui

# JWT (Autenticación — CAMBIA ESTA CLAVE por una secuencia aleatoria larga)
JWT_CLAVE_SECRETA=EscalaADN_ClaveSecreta_2025_CambiaMeEnProduccion_XyZ9!@#

# URL del frontend (para CORS)
URL_FRONTEND_PERMITIDA=http://localhost:3000

# Entorno
ENTORNO=desarrollo
```

### 6.4 Verificar que PHP puede conectarse a PostgreSQL
Abre tu navegador y ve a:
- **Laragon (Windows):** http://escala-adn.test/api/salud
- **MAMP (Mac):** http://localhost:8888/escala-adn/api/salud

Debes ver una respuesta JSON como:
```json
{
  "estado": "ok",
  "mensaje": "API Escala ADN funcionando correctamente",
  "base_de_datos": "conectada"
}
```

---

## PARTE 7 — EJECUTAR LA PLATAFORMA LOCALMENTE

### 7.1 Configurar las variables de entorno del frontend
1. En la carpeta `frontend/`, busca el archivo `.env.local.example`
2. Cópialo y renómbralo a `.env.local`
3. Configura la URL del backend PHP:
```env
# URL del backend PHP
NEXT_PUBLIC_API_URL=http://localhost/escala-adn/api
# o si usas Laragon:
NEXT_PUBLIC_API_URL=http://escala-adn.test/api
# o si usas MAMP en Mac:
NEXT_PUBLIC_API_URL=http://localhost:8888/escala-adn/api
```

### 7.2 Arrancar el servidor del frontend
En la terminal de VS Code, asegúrate de estar en la carpeta `frontend/`:
```bash
cd frontend
npm run dev
```
Verás:
```
▲ Next.js 14.x.x
- Local:   http://localhost:3000
- Network: http://192.168.x.x:3000
- Ready in 1.5s
```

### 7.3 Verificar que todo funciona
1. Abre tu navegador y ve a **http://localhost:3000**
2. Debes ver la pantalla de inicio de sesión de Escala ADN con el diseño corporativo
   (fondo en tonos arena/beige con el logo y el formulario de acceso centrado)
3. Ingresa con las credenciales del superadministrador (ver sección 8)
4. Según el rol del usuario que inicia sesión, el sistema lo redirige automáticamente:
   - **CEO, TI, Contable** → Dashboard principal
   - **Personal Base** → Gestor de Contraseñas
   - **Proveedor** → Cuentas de Cobro

### 7.4 Mantener los servidores activos
Para que la plataforma funcione, debes tener:
- **Terminal 1:** `npm run dev` (frontend Next.js)
- **Laragon/MAMP:** Activo (backend PHP + base de datos)

Cada vez que apagues el computador, deberás:
1. Abrir Laragon/MAMP y hacer clic en "Start"
2. Abrir la terminal en VS Code y ejecutar `npm run dev`

---

## PARTE 8 — CREDENCIALES DE ACCESO Y ROLES DEL SISTEMA

### 8.1 Usuario superadministrador (TI)
```
Correo:     soporteti@escala.edu.co
Contraseña: Escala2026*
Rol:        TI
```

### 8.2 Usuarios de prueba incluidos en el sistema

| Nombre | Correo | Contraseña | Rol | Aterriza en |
|--------|--------|------------|-----|-------------|
| Carlos Andrés Morales | soporteti@escala.edu.co | Escala2026* | TI | Dashboard |
| Valentina Ríos Herrera | ceo@escala.edu.co | Ceo@2025! | CEO | Dashboard |
| Jorge Luis Ospina | contable@escala.edu.co | Contable#2025 | Contable | Dashboard |
| María Fernanda Castro | mfcastro@escala.edu.co | Mfc@Escala25 | Personal Base | Gestor Contraseñas |
| Distribuidora LogiCol S.A.S | pagos@logicol.com | LogiCol#2025 | Proveedor | Cuentas de Cobro |

### 8.3 Detalle de permisos por rol

#### ROL: CEO
- Ve el dashboard con métricas globales de toda la empresa.
- Accede a todos los módulos sin excepción.
- Ve **todas** las contraseñas de todos los usuarios en la bóveda (incluyendo las de TI).
- Puede editar y eliminar cualquier credencial de cualquier usuario.
- Ve el tablero contable con las cuentas de cobro de **todos** los usuarios.
- Es el único (junto con Contable) que puede **Autorizar** o **Rechazar** cuentas de cobro.
- Puede crear, editar y desactivar usuarios de cualquier rol.
- Puede agregar, editar y consultar proveedores y sus transacciones.

#### ROL: TI
- Ve el dashboard con métricas globales.
- Ve las contraseñas de todos los usuarios **excepto las del CEO**.
- Solo puede editar o eliminar las contraseñas que él mismo creó.
- En el módulo de cuentas de cobro **solo ve y gestiona su propia cuenta**.
  No tiene acceso al tablero contable. No puede aprobar ni rechazar.
- Puede crear, editar y desactivar usuarios de cualquier rol.
- Puede agregar, editar y consultar proveedores y sus transacciones.

#### ROL: Contable
- Ve el dashboard con métricas globales.
- Solo ve sus propias contraseñas en la bóveda (no ve las de otros usuarios).
- Ve el tablero contable con las cuentas de cobro de **todos** los usuarios.
- Puede **Autorizar** o **Rechazar** cuentas de cobro.
- Puede agregar, editar y consultar proveedores y sus transacciones.
- No tiene acceso al módulo de Usuarios y Roles.

#### ROL: Personal Base
- Ve solo su propio gestor de contraseñas (no ve credenciales de otros).
- Solo ve, crea y hace seguimiento de **su propia cuenta de cobro** en Mis Pagos.
- No ve las cuentas de cobro de ningún otro usuario.
- No tiene acceso a Dashboard, Usuarios, ni Proveedores.

#### ROL: Proveedor
- Solo puede crear y enviar su cuenta de cobro.
- Solo ve el estado de **sus propias cuentas** en el módulo Mis Pagos.
- No tiene acceso a ningún otro módulo.
- No ve las cuentas de cobro de ningún otro usuario ni proveedor.

> **SEGURIDAD:** En producción, cambia todas las contraseñas inmediatamente después
> del primer inicio de sesión. En la base de datos, las contraseñas se almacenan
> como hash Argon2id generado en PHP — **nunca en texto plano**.

---

## PARTE 9 — SOLUCIÓN DE PROBLEMAS FRECUENTES

### Error: "npm not found" o "node not found"
**Causa:** Node.js no está instalado o no está en el PATH del sistema.
**Solución:**
1. Reinstala Node.js desde https://nodejs.org/
2. Reinicia la computadora
3. Abre una nueva terminal y vuelve a intentarlo

### Error: "Cannot connect to PostgreSQL"
**Causa:** El servicio de PostgreSQL no está corriendo.
**Solución Windows:**
1. Presiona `Windows + R`, escribe `services.msc`
2. Busca **"postgresql-x64-16"** (o la versión instalada)
3. Haz clic derecho → **"Iniciar"**

**Solución Mac:**
```bash
brew services start postgresql@16
# o desde MAMP, asegúrate de que MySQL/PostgreSQL esté activo
```

### Error en el script SQL: "database does not exist"
**Causa:** No creaste la base de datos antes de ejecutar el script.
**Solución:** Repite el paso 5.3 y crea la base de datos `escala_adn` primero.

### Error en el script SQL: "relation already exists"
**Causa:** Ya ejecutaste el script anteriormente y las tablas ya existen.
**Solución:** El script usa `CREATE TABLE IF NOT EXISTS` por lo que es seguro ejecutarlo
de nuevo — simplemente ignorará las tablas ya existentes. Si aun así hay conflictos:
1. En pgAdmin, haz clic derecho sobre la base de datos `escala_adn`
2. Selecciona **"Delete/Drop"** → confirma con **"Yes"**
3. Recrea la base de datos vacía desde el paso 5.3
4. Vuelve a ejecutar el script desde cero

### Error en el script SQL: "permission denied for table roles"
**Causa:** El usuario PostgreSQL no tiene permisos suficientes.
**Solución:**
1. En pgAdmin, conéctate como `postgres` (superusuario)
2. Abre el Query Tool y ejecuta:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE escala_adn TO postgres;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
   ```
3. Vuelve a ejecutar el script completo

### Error: "value too long for type character varying(30)" en roles
**Causa:** El nombre del rol `Personal_base` tiene el guion bajo correcto.
**Solución:** Asegúrate de copiar el script exactamente, sin modificar los valores de los roles. El valor correcto es `Personal_base` (con P mayúscula y guion bajo).

### Aparece "Acceso Restringido" al ingresar a un módulo
**Causa:** El rol del usuario no tiene permiso para ese módulo.
**Explicación:** Esto es un comportamiento esperado y correcto del sistema. Cada rol
solo puede acceder a los módulos listados en la Tabla de Roles y Permisos (inicio de esta guía).
Por ejemplo, un usuario con rol `Personal_base` que intente navegar al Dashboard verá
la pantalla de acceso restringido y será redirigido automáticamente.

### El botón "Autorizar" o "Rechazar" no aparece en Cuentas de Cobro
**Causa:** Solo los roles CEO y Contable tienen acceso al tablero de aprobación.
**Explicación:** Esto es correcto. TI, Personal Base y Proveedor solo ven su propio
formulario para crear cuentas. Solo CEO y Contable ven el tablero completo con todos
los botones de aprobación.

### La aplicación abre pero SIN estilos (todo blanco, sin colores ni diseño)

Esta es la falla más común al instalar localmente. La aplicación carga
y se ve como HTML plano sin ningún estilo — exactamente como la imagen de abajo:
los inputs sin borde redondeado, sin colores corporativos, sin tarjetas, todo
pegado a la izquierda. El login funciona pero la interfaz parece un documento
de texto sin formato.

**Causa raíz exacta:** Tailwind CSS v4 requiere el paquete `@tailwindcss/postcss`
instalado en `node_modules` en tiempo de compilación. Si ese paquete no está
disponible (porque no se ejecutó `npm install` correctamente, o se usó la bandera
`--production`, o la instalación falló silenciosamente), Next.js sirve el HTML
pero no procesa el CSS. El resultado es la página sin estilos.

**Diagnóstico y solución — sigue estos pasos en orden:**

---

**Paso 1 — Detener el servidor si está corriendo**

En la terminal donde ejecutaste `npm run dev`, presiona:
```
Ctrl + C
```
Espera a que la terminal vuelva al prompt (`>`).

---

**Paso 2 — Eliminar node_modules y el lock file (reinstalación limpia)**

Es importante eliminar la instalación anterior completa antes de reintentar.

En Windows (PowerShell o CMD, desde la carpeta `frontend/`):
```
rmdir /s /q node_modules
del package-lock.json
```

En Mac o Linux (Terminal, desde la carpeta `frontend/`):
```bash
rm -rf node_modules
rm package-lock.json
```

---

**Paso 3 — Verificar tu versión de Node.js**

Tailwind CSS v4 y Next.js 16 requieren Node.js **18.18 o superior**.
Ejecuta:
```bash
node -v
```

El resultado debe mostrar `v18.x.x`, `v20.x.x` o `v22.x.x`.

Si muestra una versión menor a `v18.18.0`:
1. Ve a https://nodejs.org
2. Descarga la versión **LTS** (Long Term Support) — es el botón verde grande
3. Instálala y **reinicia tu computador**
4. Abre una nueva terminal y repite este paso para confirmar la versión

---

**Paso 4 — Reinstalar las dependencias correctamente**

Este es el comando exacto. No agregues ninguna bandera adicional como
`--production`, `--only=prod` o similares:

```bash
npm install
```

Espera a que termine completamente. Puede tardar entre 2 y 8 minutos
dependiendo de tu conexión a internet. Al finalizar debe aparecer algo como:
```
added 847 packages in 3m
```
Si ves `added 0 packages` o un número muy bajo (menos de 100), algo falló.

---

**Paso 5 — Verificar que Tailwind CSS se instaló correctamente**

Este es el paquete crítico que procesa los estilos. Verifica que existe:

En Windows:
```
dir node_modules\@tailwindcss\postcss
```

En Mac o Linux:
```bash
ls node_modules/@tailwindcss/postcss
```

Si el resultado dice `No se puede encontrar`, `No such file or directory`
o cualquier mensaje de error, el paso 4 no funcionó. Intenta con:
```bash
npm install @tailwindcss/postcss tailwindcss --save
```

---

**Paso 6 — Eliminar la caché de compilación de Next.js**

En Windows:
```
rmdir /s /q .next
```

En Mac o Linux:
```bash
rm -rf .next
```

---

**Paso 7 — Arrancar el servidor de nuevo**

```bash
npm run dev
```

Espera a ver en la terminal:
```
▲ Next.js 16.x.x
- Local:  http://localhost:3000
✓ Ready in Xs
```

---

**Paso 8 — Abrir el navegador con recarga forzada (sin caché)**

Abre el navegador y ve a **http://localhost:3000**.

Luego haz una recarga forzada para limpiar cualquier versión guardada en caché:
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

Si los estilos aparecen ahora, el problema estaba en la caché del navegador.

---

**Paso 9 — Si aún no funcionan los estilos: verificar el archivo postcss.config.mjs**

Abre el archivo `postcss.config.mjs` en VS Code y verifica que tenga exactamente
este contenido (sin modificaciones):

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
export default config
```

Si el archivo no existe o tiene diferente contenido, créalo o corrígelo.

---

**Paso 10 — Si nada funciona: verificar con este comando de diagnóstico**

```bash
node -e "require('@tailwindcss/postcss'); console.log('OK - Tailwind PostCSS encontrado')"
```

Si muestra `OK - Tailwind PostCSS encontrado`, el paquete está instalado
y el problema es otro (ver paso 9).

Si muestra `Error: Cannot find module`, ejecuta:
```bash
npm install @tailwindcss/postcss@latest tailwindcss@latest --save
npm run dev
```

---

### La pantalla de login aparece completamente en blanco (sin texto)
**Causa:** Error de compilación de Next.js.
**Solución:**
1. Detén el servidor (`Ctrl + C`)
2. Borra la carpeta `.next/` dentro de `frontend/`
3. Ejecuta `npm run dev` nuevamente
4. Revisa los mensajes de error en la terminal — el error exacto aparecerá en rojo

### Error CORS: "Access-Control-Allow-Origin"
**Causa:** El frontend y el backend tienen URLs diferentes a las configuradas.
**Solución:**
1. Verifica que `NEXT_PUBLIC_API_URL` en `.env.local` apunta correctamente al backend PHP
2. Verifica que `URL_FRONTEND_PERMITIDA` en `.env` del backend apunta a `http://localhost:3000`

### PHP no encuentra la extensión pgsql
**Causa:** PHP no tiene el driver de PostgreSQL habilitado.
**Solución Windows (Laragon):**
1. Abre Laragon → clic en "PHP" → "php.ini"
2. Busca `;extension=pgsql` y `;extension=pdo_pgsql`
3. Elimina el `;` al inicio de cada línea para descomentarlas
4. Guarda y reinicia Laragon

**Solución Ubuntu/Debian:**
```bash
sudo apt install php8.2-pgsql
sudo systemctl restart apache2
```

---

## PARTE 10 — ESTRUCTURA COMPLETA DEL PROYECTO

```
escala-adn/
│
├── frontend/                          ← Aplicación web Next.js
│   ├── app/
│   │   ├── page.tsx                   ← Aplicación principal (módulos completos)
│   │   ├── layout.tsx                 ← Layout raíz con metadatos
│   │   └── globals.css                ← Sistema de diseño y paleta corporativa
│   ├── components/
│   │   ├── autenticacion/
│   │   ├── panel/
│   │   └── modulos/
│   ├── lib/
│   │   ├── tipos.ts                   ← Tipos e interfaces TypeScript
│   │   ├── utilidades.ts              ← Funciones utilitarias
│   │   └── datos-mock.ts              ← Datos de prueba iniciales
│   ├── public/
│   │   └── GUIA_INSTALACION_LOCAL.md  ← Esta guía
│   ├── .env.local.example             ← Plantilla de variables de entorno
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                           ← API REST en PHP
│   ├── api/
│   │   ├── autenticacion/
│   │   │   ├── ingresar.php           ← POST /api/autenticacion/ingresar
│   │   │   └── cerrar_sesion.php      ← POST /api/autenticacion/cerrar_sesion
│   │   ├── usuarios/
│   │   │   ├── listar.php             ← GET  /api/usuarios
│   │   │   ├── crear.php              ← POST /api/usuarios
│   │   │   ├── actualizar.php         ← PUT  /api/usuarios/{id}
│   │   │   └── eliminar.php           ← DELETE /api/usuarios/{id}
│   │   ├── contrasenas/
│   │   │   ├── listar.php
│   │   │   ├── crear.php
│   │   │   ├── actualizar.php
│   │   │   └── eliminar.php
│   │   ├── proveedores/
│   │   │   ├── listar.php
│   │   │   ├── crear.php
│   │   │   ├── actualizar.php
│   │   │   └── eliminar.php
│   │   ├── transacciones/
│   │   │   ├── listar.php
│   │   │   ├── crear.php
│   │   │   └── eliminar.php
│   │   └── cuentas_cobro/
│   │       ├── listar.php
│   │       ├── crear.php
│   │       ├── autorizar.php
│   │       └── rechazar.php
│   ├── config/
│   │   ├── base_de_datos.php          ← Conexión PDO a PostgreSQL
│   │   ├── cors.php                   ← Configuración de CORS
│   │   └── jwt.php                    ← Utilidades JWT
│   ├── middleware/
│   │   ├── autenticacion.php          ← Verificación de token JWT
│   │   └── autorizacion.php           ← Verificación de roles
│   ├── modelos/
│   │   ├── ModeloUsuario.php
│   │   ├── ModeloCredencial.php
│   │   ├── ModeloProveedor.php
│   │   └── ModeloCuentaCobro.php
│   ├── .env.example                   ← Plantilla de variables de entorno
│   └── .htaccess                      ← Configuración Apache/URL amigables
│
└── scripts/
    └── escala_adn_database.sql        ← Script completo de base de datos PostgreSQL
```

---

## RESUMEN RÁPIDO (PARA EJECUTAR CADA DÍA)

```bash
# 1. Inicia Laragon (Windows) o MAMP (Mac) → clic en "Start"

# 2. Abre VS Code en la carpeta del proyecto

# 3. En la terminal integrada, ve al frontend:
cd frontend

# 4. Arranca el servidor de desarrollo:
npm run dev

# 5. Abre en el navegador:
#    http://localhost:3000

# 6. Ingresa con:
#    Correo: soporteti@escala.edu.co
#    Contraseña: Escala2026*
```

---

## PARTE 11 — INTEGRACIÓN CON GOOGLE DRIVE (ALMACENAMIENTO DE ADJUNTOS)

Esta sección explica cómo conectar el sistema Escala ADN con Google Drive para que
los adjuntos de las cuentas de cobro (PDF cuenta, certificado bancario, seguridad social
y comprobante de pago) se guarden directamente en una carpeta de Google Drive de la empresa,
en lugar de en el servidor local.

### ¿Por qué Google Drive?

- Los archivos quedan organizados y accesibles desde cualquier dispositivo.
- No se ocupa espacio en el servidor de hosting.
- Se pueden compartir carpetas con el equipo contable sin entrar al sistema.
- Google Drive tiene 15 GB gratuitos por cuenta y planes económicos para empresas.

---

### PASO 1 — Crear el proyecto en Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Inicia sesión con el correo corporativo de Escala (el que usará Google Drive).
3. Haz clic en el selector de proyecto (esquina superior izquierda) → **"Nuevo proyecto"**.
4. Nombre del proyecto: `escala-adn-drive`
5. Haz clic en **"Crear"**.

---

### PASO 2 — Habilitar la API de Google Drive

1. En el menú lateral ve a **"APIs y servicios"** → **"Biblioteca"**.
2. Busca **"Google Drive API"**.
3. Haz clic en el resultado y luego en **"Habilitar"**.

---

### PASO 3 — Crear una cuenta de servicio (Service Account)

La cuenta de servicio actúa como un "robot" que puede subir archivos a Drive
sin necesidad de que ningún usuario humano esté conectado.

1. Ve a **"APIs y servicios"** → **"Credenciales"**.
2. Haz clic en **"+ Crear credenciales"** → **"Cuenta de servicio"**.
3. Rellena:
   - **Nombre:** `escala-drive-uploader`
   - **ID:** se genera automáticamente
   - **Descripción:** `Sube adjuntos de cuentas de cobro a Google Drive`
4. Haz clic en **"Crear y continuar"**.
5. En "Rol", selecciona **"Editor"** → **"Continuar"** → **"Listo"**.
6. Ahora verás la cuenta de servicio listada. Haz clic en ella.
7. Ve a la pestaña **"Claves"** → **"Agregar clave"** → **"Crear nueva clave"**.
8. Selecciona formato **JSON** → **"Crear"**.
9. Se descargará un archivo `.json`. Este es tu archivo de credenciales.
   **Guárdalo con el nombre:** `google-drive-credentials.json`

> **IMPORTANTE:** Nunca subas este archivo a GitHub ni lo compartas.
> Añade `google-drive-credentials.json` a tu `.gitignore`.

---

### PASO 4 — Crear la carpeta en Google Drive y compartirla

1. Ve a https://drive.google.com/ con el correo corporativo.
2. Crea una carpeta llamada **"Escala ADN — Cuentas de Cobro"**.
3. Dentro, crea subcarpetas:
   ```
   Escala ADN — Cuentas de Cobro/
   ├── Cuentas de Cobro/
   ├── Certificados Bancarios/
   ├── Seguridad Social/
   └── Comprobantes de Pago/
   ```
4. Haz clic derecho en la carpeta raíz → **"Compartir"**.
5. En el campo "Agregar personas", pega el correo de la cuenta de servicio.
   El correo tiene el formato: `escala-drive-uploader@escala-adn-drive.iam.gserviceaccount.com`
   (lo encuentras en el archivo `.json` descargado, campo `"client_email"`).
6. Dale permisos de **"Editor"** → **"Enviar"**.
7. Copia el **ID de la carpeta raíz**. El ID está en la URL de Drive:
   `https://drive.google.com/drive/folders/`**`1aBcDeFgHiJkLmNoPqRsTuVwXy`**
   Guarda ese ID, lo necesitarás en el siguiente paso.

---

### PASO 5 — Configurar variables de entorno en el backend PHP

Abre el archivo `backend/.env` y agrega:

```env
# ── Google Drive ──────────────────────────────────────────────────────────────
GOOGLE_DRIVE_CREDENTIALS_PATH=/ruta/absoluta/al/google-drive-credentials.json
GOOGLE_DRIVE_FOLDER_CUENTAS=ID_DE_SUBCARPETA_CUENTAS_DE_COBRO
GOOGLE_DRIVE_FOLDER_CERT_BANCARIO=ID_DE_SUBCARPETA_CERTIFICADOS
GOOGLE_DRIVE_FOLDER_SEG_SOCIAL=ID_DE_SUBCARPETA_SEGURIDAD_SOCIAL
GOOGLE_DRIVE_FOLDER_COMPROBANTES=ID_DE_SUBCARPETA_COMPROBANTES
```

> Para obtener el ID de cada subcarpeta, ábrela en Drive y copia el segmento
> de la URL después de `/folders/`.

---

### PASO 6 — Instalar la librería de Google en PHP (backend)

En la carpeta `backend/`, ejecuta:

```bash
composer require google/apiclient:^2.15
```

Si no tienes Composer instalado:
- **Windows:** Descárgalo de https://getcomposer.org/download/
- **Mac:** `brew install composer`

---

### PASO 7 — Crear el servicio PHP para subir archivos

Crea el archivo `backend/servicios/GoogleDriveServicio.php`:

```php
<?php
/**
 * GoogleDriveServicio.php
 * Servicio para subir archivos adjuntos de cuentas de cobro a Google Drive.
 *
 * Uso:
 *   $drive = new GoogleDriveServicio();
 *   $urlPublica = $drive->subirArchivo(
 *       '/tmp/adjunto.pdf',
 *       'CuentaCobro_Carlos_Jun2025.pdf',
 *       $_ENV['GOOGLE_DRIVE_FOLDER_CUENTAS']
 *   );
 */

require_once __DIR__ . '/../vendor/autoload.php';

class GoogleDriveServicio {
    private Google\Client $cliente;
    private Google\Service\Drive $drive;

    public function __construct() {
        $this->cliente = new Google\Client();
        $this->cliente->setAuthConfig($_ENV['GOOGLE_DRIVE_CREDENTIALS_PATH']);
        $this->cliente->setScopes([Google\Service\Drive::DRIVE]);
        $this->drive = new Google\Service\Drive($this->cliente);
    }

    /**
     * Sube un archivo a una carpeta específica de Google Drive.
     *
     * @param string $rutaLocal    Ruta temporal del archivo en el servidor.
     * @param string $nombreFinal  Nombre con el que quedará en Drive.
     * @param string $carpetaId    ID de la carpeta destino en Drive.
     * @return string              URL pública para visualizar el archivo.
     */
    public function subirArchivo(
        string $rutaLocal,
        string $nombreFinal,
        string $carpetaId
    ): string {
        $metadatos = new Google\Service\Drive\DriveFile([
            'name'    => $nombreFinal,
            'parents' => [$carpetaId],
        ]);

        $contenido  = file_get_contents($rutaLocal);
        $mimeType   = mime_content_type($rutaLocal);

        $archivo = $this->drive->files->create($metadatos, [
            'data'       => $contenido,
            'mimeType'   => $mimeType,
            'uploadType' => 'multipart',
            'fields'     => 'id, webViewLink',
        ]);

        // Hacer el archivo accesible con el enlace (sin ser público en Internet)
        $permiso = new Google\Service\Drive\Permission([
            'type' => 'domain',          // Solo usuarios del dominio escala.edu.co
            'role' => 'reader',
            // Para acceso completamente privado, omite este bloque de permisos
        ]);
        // Descomentar solo si quieres compartir dentro del dominio:
        // $this->drive->permissions->create($archivo->getId(), $permiso);

        return $archivo->getWebViewLink();
    }

    /**
     * Elimina un archivo de Drive por su ID.
     * Útil si el usuario reemplaza un adjunto.
     *
     * @param string $archivoId  ID del archivo en Drive (no la URL).
     */
    public function eliminarArchivo(string $archivoId): void {
        $this->drive->files->delete($archivoId);
    }
}
```

---

### PASO 8 — Usar el servicio en el endpoint de cuentas de cobro

Modifica `backend/api/cuentas_cobro/crear.php` para llamar al servicio:

```php
<?php
require_once __DIR__ . '/../../servicios/GoogleDriveServicio.php';

// ... (código de autenticación JWT existente) ...

$drive = new GoogleDriveServicio();

// Subir cada adjunto al folder correspondiente en Drive
$urlCuenta = $urlCertBancario = $urlSegSocial = null;

if (!empty($_FILES['adjunto_cuenta_cobro']['tmp_name'])) {
    $urlCuenta = $drive->subirArchivo(
        $_FILES['adjunto_cuenta_cobro']['tmp_name'],
        'CuentaCobro_' . $nombreSolicitante . '_' . date('Y-m-d') . '.pdf',
        $_ENV['GOOGLE_DRIVE_FOLDER_CUENTAS']
    );
}

if (!empty($_FILES['adjunto_cert_bancario']['tmp_name'])) {
    $urlCertBancario = $drive->subirArchivo(
        $_FILES['adjunto_cert_bancario']['tmp_name'],
        'CertBancario_' . $nombreSolicitante . '_' . date('Y-m-d') . '.pdf',
        $_ENV['GOOGLE_DRIVE_FOLDER_CERT_BANCARIO']
    );
}

if (!empty($_FILES['adjunto_seg_social']['tmp_name'])) {
    $urlSegSocial = $drive->subirArchivo(
        $_FILES['adjunto_seg_social']['tmp_name'],
        'SegSocial_' . $nombreSolicitante . '_' . date('Y-m') . '.pdf',
        $_ENV['GOOGLE_DRIVE_FOLDER_SEG_SOCIAL']
    );
}

// Guardar las URLs en la base de datos en lugar del nombre de archivo
$stmt = $pdo->prepare("
    INSERT INTO cuentas_cobro
        (usuario_id, nombre_solicitante, ..., adjunto_cuenta_cobro, adjunto_cert_bancario, adjunto_seg_social)
    VALUES
        (:usuario_id, :nombre, ..., :url_cuenta, :url_cert, :url_social)
");
$stmt->execute([
    ':url_cuenta' => $urlCuenta,
    ':url_cert'   => $urlCertBancario,
    ':url_social' => $urlSegSocial,
    // ... demás campos ...
]);
```

> **Nota:** La columna `adjunto_cuenta_cobro` en PostgreSQL debe cambiarse de
> `VARCHAR(500)` a `TEXT` para almacenar URLs completas de Google Drive.

---

### PASO 9 — Cambio necesario en la base de datos

Ejecuta este SQL en pgAdmin para ajustar las columnas de adjuntos:

```sql
-- Ampliar columnas de adjuntos para almacenar URLs de Google Drive
ALTER TABLE cuentas_cobro
    ALTER COLUMN adjunto_cuenta_cobro TYPE TEXT,
    ALTER COLUMN adjunto_cert_bancario TYPE TEXT,
    ALTER COLUMN adjunto_seg_social    TYPE TEXT,
    ALTER COLUMN adjunto_comprobante   TYPE TEXT;

-- Agregar columna para el ID del archivo en Drive (útil para eliminarlo después)
ALTER TABLE cuentas_cobro
    ADD COLUMN IF NOT EXISTS drive_id_cuenta       VARCHAR(200),
    ADD COLUMN IF NOT EXISTS drive_id_cert         VARCHAR(200),
    ADD COLUMN IF NOT EXISTS drive_id_seg_social   VARCHAR(200),
    ADD COLUMN IF NOT EXISTS drive_id_comprobante  VARCHAR(200);

COMMENT ON COLUMN cuentas_cobro.adjunto_cuenta_cobro IS 'URL de visualización en Google Drive';
COMMENT ON COLUMN cuentas_cobro.drive_id_cuenta       IS 'ID del archivo en Drive para poder eliminarlo';
```

---

### PASO 10 — Mostrar el link en el frontend

Una vez que el backend devuelve URLs de Drive en lugar de nombres de archivo,
actualiza el componente de adjuntos en Next.js para mostrarlos como enlaces:

```tsx
// En el módulo de cuentas de cobro (page.tsx), reemplaza el chip de adjunto por un link:
{cc.adjuntoCuentaCobro && (
  <a
    href={cc.adjuntoCuentaCobro}        // URL completa de Google Drive
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 text-xs bg-[var(--cl)] text-[var(--cp)] px-2 py-1 rounded-lg hover:underline"
  >
    <IcoArchivo /> Ver Cuenta de Cobro
  </a>
)}
```

---

### Resumen del flujo completo con Google Drive

```
Usuario sube PDF en el formulario
        ↓
Next.js envía el archivo al backend PHP (multipart/form-data)
        ↓
PHP recibe el archivo en $_FILES[]
        ↓
GoogleDriveServicio::subirArchivo() lo envía a Google Drive
        ↓
Google Drive devuelve el ID y la URL de visualización
        ↓
PHP guarda la URL en PostgreSQL (columna adjunto_*)
        ↓
Next.js muestra el link "Ver documento" en la interfaz
        ↓
CEO / Contable hace clic → abre el PDF directamente en Google Drive
```

---

### Errores comunes en la integración con Google Drive

| Error | Causa probable | Solución |
|---|---|---|
| `invalid_grant` | Archivo de credenciales incorrecto o expirado | Descarga un nuevo archivo JSON desde Cloud Console |
| `forbidden: insufficientPermissions` | La carpeta no está compartida con la cuenta de servicio | Repite el Paso 4 y comparte la carpeta con el email de la service account |
| `File not found` al eliminar | El `drive_id` guardado es incorrecto | Verifica que se esté guardando el `$archivo->getId()` y no la URL |
| Archivo sube vacío | `tmp_name` está vacío porque PHP rechazó el archivo | Revisa `upload_max_filesize` y `post_max_size` en `php.ini` (aumentar a `20M`) |
| `composer not found` | Composer no está instalado | Instala desde https://getcomposer.org |

---

*Guía generada para Escala Consciencia & Negocios BIC SAS — NIT: 811.007.550-3*
*Versión del sistema: Escala ADN v1.0.0*
