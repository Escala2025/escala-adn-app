# Despliegue en Render

Esta guía explica cómo desplegar **Escala ADN App** en Render en 5 minutos.

## Requisitos previos

1. **Cuenta en Render** → Registrate en https://render.com (puedes usar GitHub)
2. **Repositorio GitHub** → Tu código debe estar en GitHub
3. **Base de datos PostgreSQL** → Puedes usar la de Render o una existente

## Paso 1: Pushear el código a GitHub

```bash
# Asegúrate de que estés en la rama main
git add .
git commit -m "Configuración para Render"
git push origin main
```

## Paso 2: Crear un Web Service en Render

1. Ve a https://dashboard.render.com
2. Click en **New +** → **Web Service**
3. Conecta tu repositorio GitHub
4. Selecciona el repositorio `escala-adn-app`
5. Llena los campos:
   - **Name**: `escala-adn-app` (o el nombre que prefieras)
   - **Environment**: `Docker`
   - **Branch**: `main`
   - **Docker**: Render automáticamente detectará el `Dockerfile`
   - **Instance Type**: `Standard` (o Starter si quieres ahorrar dinero)

## Paso 3: Configurar variables de entorno

En la sección **Environment**, agrega:

```
DATABASE_URL=postgresql://usuario:contraseña@host:5432/escala_adn
NODE_ENV=production
```

**Importante**: Reemplaza los valores con tu BD real.

### Opción: Crear BD en Render

Si no tienes BD, crea una en Render:

1. Ve a **Databases** en el dashboard
2. Click en **New +** → **PostgreSQL**
3. Copia el `External Database URL`
4. Úsala como `DATABASE_URL` en el Web Service

## Paso 4: Deploy

Click en **Create Web Service**.

Render automáticamente:

- Clona tu repo
- Construye la imagen Docker
- Deploya tu app
- Asigna una URL pública (algo como `https://escala-adn-app-xxxxx.onrender.com`)

El deploy toma 5-10 minutos la primera vez.

## Verificar que está online

1. Ve al dashboard de Render
2. Abre la URL de tu app
3. Deberías ver Escala ADN cargando

## Parar/Reanudar el servicio

- Click en el Web Service
- **Settings** → **Pause service** o **Resume**

Render pausará automáticamente los servicios gratuitos después de 15 minutos sin actividad.

## Redeploy manual

Si hiciste cambios:

```bash
git push origin main
```

Render automáticamente detectará el push y hará un nuevo deploy.

## Logs

Para ver los logs en tiempo real:

- Dashboard → Tu Web Service → **Logs**

## Troubleshooting

### "Health check failed"

- Asegúrate de que `DATABASE_URL` está correctamente configurada
- Verifica que la BD es accesible desde la red de Render

### "Port binding error"

- Render usa puerto `3000` por defecto
- Next.js ya escucha en `:3000`, así que debe funcionar

### "node_modules install failed"

- Verifica que el `package-lock.json` está en el repo
- Los logs deberían mostrar el error específico

## Costos

- **Gratuito**: 0.5 GB RAM, auto-pausa
- **Starter**: $7/mes, siempre activo, 0.5 GB RAM
- **Standard**: $12/mes, 1 GB RAM

Para producción, recomiendo al menos **Starter**.
