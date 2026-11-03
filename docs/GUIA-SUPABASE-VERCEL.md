# Guía: conectar Supabase y Vercel (cierre de la Fase 0)

Sigue los pasos en orden. Ninguno requiere instalar nada en tu computadora. **No compartas claves en el chat.**

---

## Paso B. Crear el proyecto de Supabase

1. **Qué:** la base de datos y el inicio de sesión de la app.
2. **Para qué:** guardar tu información en la nube, protegida por usuario, y sincronizarla entre celular y tablet.
3. **Dónde:** https://supabase.com/dashboard → **New project**.
4. **Datos:**
   - Name: `asistente-ejecutivo`
   - Database password: una contraseña fuerte, guárdala en tu gestor de contraseñas (no me la mandes).
   - Region: **East US (North Virginia)** o la más cercana a México que aparezca.
   - Plan: Free.
5. **Comprobación:** después de 1–2 minutos el proyecto aparece como activo y ves el panel "Project overview".

## Paso C. Crear las tablas (aplicar el esquema)

1. **Qué:** ejecutar el archivo SQL que crea las 22 tablas, las políticas de seguridad y las funciones.
2. **Para qué:** dejar la base de datos lista para la app.
3. **Dónde:** en Supabase, menú izquierdo → **SQL Editor** → **New query**.
4. **Datos:**
   - Abre https://github.com/msanchezsx/AsistentePersonalGlamma/blob/main/supabase/migrations/20261103000001_initial_schema.sql
   - Pulsa el botón **Copy raw file** (ícono de copiar arriba a la derecha del archivo).
   - Pégalo en el editor de Supabase y pulsa **Run**.
5. **Comprobación:** aparece "Success. No rows returned". En **Table Editor** ves tablas como `tasks`, `meetings`, `devices`, y cada una muestra el candado de **RLS enabled**.

## Paso D. Configurar el inicio de sesión

1. **Qué:** permitir solo tu correo y el enlace de acceso sin contraseña.
2. **Para qué:** que nadie más pueda crear una cuenta.
3. **Dónde y datos:**
   - **Authentication → Sign In / Providers**: deja **Email** activo y **desactiva "Allow new users to sign up"**. Guarda.
   - **Authentication → Users → Add user → Send invitation**: escribe tu correo (el que usarás para entrar).
   - **Authentication → URL Configuration**: lo completamos en el paso F, cuando exista la URL de Vercel.
4. **Comprobación:** en Users aparece tu correo como "Invited". Recibes un correo de invitación (no es necesario abrirlo todavía).

## Paso E. Desplegar en Vercel

1. **Qué:** publicar la app en internet.
2. **Para qué:** abrirla desde tu celular y tablet, aunque Claude no esté abierto.
3. **Dónde:** https://vercel.com/new → inicia sesión con GitHub → **Import** el repositorio `AsistentePersonalGlamma` (si no aparece, pulsa "Adjust GitHub App Permissions" y dale acceso).
4. **Datos:** antes de pulsar **Deploy**, abre **Environment Variables** y agrega:

   | Nombre | Valor | Dónde se obtiene |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API (o "Connect") → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave `anon` / `publishable` | Mismo lugar → API Keys → anon public |
   | `ALLOWED_EMAILS` | tu correo | El mismo que invitaste |
   | `APP_TIMEZONE` | `America/Mexico_City` | — |

   **No** agregues todavía la `service_role` key.
   Pulsa **Deploy**.
5. **Comprobación:** el despliegue termina en verde y Vercel te muestra una URL como `https://asistente-personal-glamma.vercel.app`. Al abrirla ves la pantalla "Asistente Ejecutivo · Acceso privado" sin el aviso amarillo de "no está conectada a Supabase".

## Paso F. Unir Supabase con la URL de Vercel

1. **Qué:** decirle a Supabase a dónde mandar el enlace de acceso.
2. **Para qué:** que el enlace del correo abra tu app.
3. **Dónde:** Supabase → **Authentication → URL Configuration**.
4. **Datos:**
   - Site URL: tu URL de Vercel (p. ej. `https://asistente-personal-glamma.vercel.app`)
   - Redirect URLs → Add URL: `https://asistente-personal-glamma.vercel.app/auth/callback`
   - En Vercel → Settings → Environment Variables agrega `NEXT_PUBLIC_SITE_URL` con la misma URL y luego **Deployments → … → Redeploy**.
5. **Comprobación:** en el paso G el enlace del correo te lleva a la app y no a `localhost`.

## Paso G. Prueba en tus dispositivos

1. **Celular:** abre la URL en Chrome → escribe tu correo → abre el enlace del correo **en el mismo celular**. Debes entrar al Inicio. Menú de Chrome → **Instalar app** / **Agregar a pantalla principal**.
2. **Tablet:** repite. Verás "Dispositivo pendiente de autorización".
3. **Celular:** Más → Configuración → Dispositivos → **Autorizar** la tablet.
4. **Tablet:** "Volver a comprobar" → entra al Inicio. Instálala también.
5. Avísame el resultado (o una captura si algo falla).
