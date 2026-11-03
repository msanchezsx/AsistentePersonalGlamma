# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] - 2026-11-03 — Fase 0

### Agregado
- Proyecto Next.js 15 + TypeScript + Tailwind CSS 4.
- Esquema PostgreSQL inicial (22 tablas) con RLS, FKs compuestas, triggers de `updated_at` y auditoría, y funciones de dispositivos.
- Pruebas de RLS en Postgres local (`npm run db:test`) y pruebas unitarias con Vitest.
- Autenticación por enlace mágico con lista de correos autorizados.
- Registro, aprobación y revocación de dispositivos (máximo 2).
- Middleware de sesión y dispositivo autorizado.
- Interfaz base: menú de 9 módulos (barra inferior en celular, lateral en tablet), Inicio, Configuración y pantallas de módulos futuros.
- PWA: manifest, iconos, service worker conservador y pantalla sin conexión.
- Cabeceras de seguridad (CSP, HSTS, etc.).
- Documentación: README, ARCHITECTURE, DATABASE, SECURITY, PROGRESS, `.env.example`.
