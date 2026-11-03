# Guía: registrar la app en Azure para Outlook (Fase 3)

**Qué:** registrar "Asistente" como aplicación en Microsoft Entra ID (Azure) para que pueda **leer** tu correo de Outlook con tu permiso.

**Para qué:** la Fase 3 lee, clasifica y resume correos, detecta compromisos y prepara borradores. No envía, borra ni modifica correos sin tu autorización explícita.

**Dónde:** https://entra.microsoft.com (o portal.azure.com) con la cuenta de Microsoft de tu correo de trabajo. Si tu empresa administra la cuenta, puede requerir que un administrador apruebe los permisos.

## Pasos

1. Entra a **Identity → Applications → App registrations → New registration**.
2. Nombre: `Asistente Glama`.
3. Tipos de cuenta: la opción que incluya tu cuenta (si dudas: *Accounts in any organizational directory and personal Microsoft accounts*).
4. Redirect URI: tipo **Web**, valor `https://asistente-personal-glamma-yv4c.vercel.app/api/outlook/callback`.
5. Crea la app. En **Overview** copia el **Application (client) ID** y el **Directory (tenant) ID**.
6. **Certificates & secrets → New client secret** (24 meses). Copia el **Value** en ese momento; después ya no se muestra.
7. **API permissions → Add a permission → Microsoft Graph → Delegated**: `Mail.Read`, `offline_access`, `User.Read`. No agregues `Mail.Send` ni `Mail.ReadWrite`.

## Datos para Vercel (Settings → Environment Variables)

| Variable | Valor | Tipo |
|---|---|---|
| `MS_GRAPH_CLIENT_ID` | Application (client) ID | Secret |
| `MS_GRAPH_CLIENT_SECRET` | Value del client secret | Secret |
| `MS_GRAPH_TENANT_ID` | Directory (tenant) ID, o `common` | Secret |
| `TOKEN_ENCRYPTION_KEY` | Te la genero yo cuando lleguemos a ese paso | Secret |

No compartas estos valores en el chat; ponlos directamente en Vercel y haz Redeploy.

## Cómo comprobar

Cuando la Fase 3 esté publicada, en **Correos → Conectar Outlook** Microsoft te mostrará la lista de permisos (solo lectura). Al aceptar, volverás a la app y verás tus correos recientes.
