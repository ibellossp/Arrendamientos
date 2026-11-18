# Arrendamientos de campo — versión para Easypanel

App web para llevar los vencimientos de arrendamientos, liquidar cuotas con precios oficiales y generar el PDF de cada liquidación. Funciona con tres piezas:

- **Easypanel (tu servidor):** corre la app, un servidor chico en Node.js dentro de un contenedor Docker, y guarda la clave de la API.
- **Supabase:** guarda los datos y los archivos (PDFs de contratos y facturas) y maneja el ingreso de usuarios.
- **Anthropic:** lee los contratos en PDF y las pizarras pegadas.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `public/index.html` | La app |
| `server.js` | Servidor: muestra la app y conecta con Claude sin exponer la clave |
| `Dockerfile` | Instrucciones para que Easypanel arme el contenedor |
| `package.json` | Datos del proyecto Node.js (no tiene dependencias externas) |
| `supabase.sql` | Crea las tablas, permisos y la carpeta de archivos |
| `respaldo-inicial.json` | Los datos que tenías en la versión de Claude |

## Paso 1: Supabase (datos y usuarios)

1. Creá una cuenta en supabase.com y un proyecto nuevo. Como región elegí São Paulo. Guardá la contraseña de la base que te pide.
2. En **SQL Editor**, abrí una consulta nueva, pegá todo el contenido de `supabase.sql` y tocá **Run**.
3. En **Authentication**, desactivá la opción que permite registrarse a usuarios nuevos («Allow new users to sign up»). Así solo entran las personas que vos des de alta.
4. En **Authentication > Users**, tocá **Add user > Create new user**, cargá mail y contraseña de cada persona y marcá que el mail quede confirmado.
5. En **Project Settings > API** copiá la **Project URL** y la clave **anon public**.

## Paso 2: clave de Anthropic (lectura de contratos)

1. En console.anthropic.com creá una cuenta y cargá crédito en **Billing** (5 a 10 USD alcanzan para muchos contratos).
2. En **API Keys** creá una clave y copiala; se muestra una sola vez.
3. Recomendado: fijá un tope de gasto mensual en **Limits**.

## Paso 3: Easypanel

1. Subí esta carpeta a un repositorio **privado** de GitHub (en GitHub: **Add file > Upload files**, arrastrando todo el contenido y respetando la carpeta `public`).
2. En Easypanel, creá un proyecto (o usá uno existente) y agregá un servicio de tipo **App**.
3. En **Source** elegí **GitHub**, conectá tu cuenta si te lo pide, y elegí el repositorio y la rama `main`.
4. En **Build** elegí **Dockerfile** (el archivo está en la raíz del repositorio).
5. En **Environment** cargá estas variables, una por línea:

   ```
   SUPABASE_URL=la Project URL del paso 1
   SUPABASE_ANON_KEY=la clave anon public del paso 1
   ANTHROPIC_API_KEY=la clave del paso 2
   ```

6. En **Domains** agregá el dominio o subdominio que quieras usar, por ejemplo `arrendamientos.tuempresa.com.ar`, apuntando al **puerto 3000** del contenedor. Si usás un dominio propio, en tu proveedor de dominio creá un registro A que apunte a la IP de tu servidor. Easypanel genera el certificado HTTPS solo.
7. Tocá **Deploy**. Cuando termine, la app queda disponible en el dominio.
8. En Supabase, **Authentication > URL Configuration**, pegá la dirección de la app en **Site URL**. Esto hace funcionar el mail de «Olvidé mi contraseña».

Para actualizar la app más adelante, reemplazá los archivos en GitHub y tocá **Deploy** de nuevo en Easypanel (o activá el despliegue automático).

## Paso 4: primer ingreso

1. Entrá a la dirección de la app con uno de los usuarios creados.
2. Tocá **Respaldo > Restaurar** y elegí `respaldo-inicial.json`.

## Uso diario y seguridad

- **Respaldo:** el botón Respaldo descarga todo (contratos, cuotas, liquidaciones y precios) en un archivo. Hacelo una vez por semana o por mes. Los PDFs y facturas quedan en Supabase.
- **Usuarios:** todos los usuarios dados de alta pueden ver y modificar. Para sacar a alguien, borralo en Supabase > Authentication > Users.
- **Claves:** nunca subas las claves a GitHub. Solo van en las variables de entorno de Easypanel.
- **Modelo de IA:** por defecto usa `claude-sonnet-5-5` para contratos y `claude-haiku-5-5` para pizarras. Se pueden cambiar con las variables `ANTHROPIC_MODEL` y `ANTHROPIC_MODEL_RAPIDO`.
- **Control de salud:** `https://tu-dominio/salud` responde «ok» si el servidor está funcionando.

## Si algo no funciona

- **«Falta la configuración del servidor»:** faltan las variables en Easypanel o no volviste a desplegar después de cargarlas.
- **La página no abre o da error 502:** revisá en Easypanel que el dominio apunte al puerto 3000 y mirá los **Logs** del servicio; tiene que aparecer «Arrendamientos escuchando en el puerto 3000».
- **No lee los contratos:** revisá `ANTHROPIC_API_KEY` y que la cuenta de Anthropic tenga crédito.
- **«Mail o contraseña incorrectos»:** revisá que el usuario esté creado y confirmado en Supabase.
- **Los cambios de otro usuario no aparecen solos:** recargá la página. Si pasa siempre, revisá que la línea `alter publication` del SQL se haya ejecutado sin error.

## Probarlo en una computadora (opcional)

Con Node.js 20 o superior instalado:

```
SUPABASE_URL=... SUPABASE_ANON_KEY=... ANTHROPIC_API_KEY=... node server.js
```

y abrí http://localhost:3000.
