export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Fase del plan en que se implementa el módulo. */
  phase: number;
  description: string;
};

export type IconName =
  "home" | "calendar" | "check" | "folder" | "mail" | "spark" | "headphones" | "chart" | "settings" | "menu";

/** Menú principal (orden definido en la especificación). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home", phase: 0, description: "Tu jornada de un vistazo." },
  {
    href: "/agenda",
    label: "Agenda",
    icon: "calendar",
    phase: 1,
    description: "Reuniones, recordatorios y vista diaria y semanal.",
  },
  {
    href: "/tareas",
    label: "Tareas",
    icon: "check",
    phase: 1,
    description: "Pendientes, prioridades, fechas límite y recurrencias.",
  },
  {
    href: "/proyectos",
    label: "Proyectos",
    icon: "folder",
    phase: 1,
    description: "Proyectos, clientes, pedidos y seguimientos.",
  },
  {
    href: "/correos",
    label: "Correos",
    icon: "mail",
    phase: 3,
    description: "Correos de Outlook clasificados y compromisos detectados.",
  },
  {
    href: "/inteligencia",
    label: "Inteligencia",
    icon: "spark",
    phase: 2,
    description: "Asistente conversacional, memoria y análisis de problemas.",
  },
  {
    href: "/podcast",
    label: "Podcast",
    icon: "headphones",
    phase: 5,
    description: "Tu resumen diario en audio de 5 a 10 minutos.",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "chart",
    phase: 6,
    description: "Indicadores de productividad y tendencias.",
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: "settings",
    phase: 0,
    description: "Perfil, jornada, notificaciones y dispositivos.",
  },
];

/** Accesos visibles en la barra inferior del celular. */
export const MOBILE_PRIMARY = ["/", "/agenda", "/tareas", "/inteligencia"];
