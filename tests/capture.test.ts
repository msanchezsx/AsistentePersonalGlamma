import { describe, expect, it } from "vitest";
import { captureFormHref, parseCapture } from "@/lib/capture";

const TODAY = "2026-11-03"; // martes

describe("parseCapture", () => {
  it("reunión con personas, fecha relativa, hora y duración", () => {
    const r = parseCapture("Junta con Ana y Luis mañana a las 10 por 30 minutos", TODAY);
    expect(r).toMatchObject({
      kind: "meeting",
      dateKey: "2026-11-04",
      time: "10:00",
      endTime: "10:30",
      participants: ["Ana", "Luis"],
    });
    expect(r.title).toBe("Junta con Ana y Luis");
  });

  it("tarea con recordatorio, día de la semana y urgencia", () => {
    const r = parseCapture("Recuérdame enviar la cotización el viernes urgente", TODAY);
    expect(r).toMatchObject({ kind: "task", dateKey: "2026-11-06", time: null, urgent: true });
    expect(r.title).toBe("Enviar la cotización");
  });

  it("'en la mañana' no es 'mañana'", () => {
    const r = parseCapture("Llamar a proveedor hoy a las 9 de la mañana", TODAY);
    expect(r).toMatchObject({ kind: "task", dateKey: TODAY, time: "09:00" });
    expect(r.title).toBe("Llamar a proveedor");
  });

  it("horas de la tarde: '4 pm', 'a las 4' y 'de la tarde'", () => {
    expect(parseCapture("Revisar pedido 4 pm", TODAY).time).toBe("16:00");
    expect(parseCapture("Revisar pedido a las 4", TODAY).time).toBe("16:00");
    expect(parseCapture("Revisar pedido a las 11", TODAY).time).toBe("11:00");
    expect(parseCapture("Cita con el contador a las 6 de la tarde", TODAY).time).toBe("18:00");
    expect(parseCapture("Junta a las 10:30", TODAY).time).toBe("10:30");
    expect(parseCapture("Comida con Pedro a mediodía", TODAY).time).toBe("12:00");
  });

  it("rango de horas", () => {
    const r = parseCapture("Reunión de ventas el jueves de 10 a 11:30", TODAY);
    expect(r).toMatchObject({ kind: "meeting", dateKey: "2026-11-05", time: "10:00", endTime: "11:30" });
    expect(r.title).toBe("Reunión de ventas");
  });

  it("fechas absolutas", () => {
    expect(parseCapture("Pagar factura el 15 de noviembre", TODAY).dateKey).toBe("2026-11-15");
    expect(parseCapture("Pagar factura el 2 de enero", TODAY).dateKey).toBe("2027-01-02");
    expect(parseCapture("Pagar factura 20/12", TODAY).dateKey).toBe("2026-12-20");
    expect(parseCapture("Pagar factura el 1", TODAY).dateKey).toBe("2026-12-01");
    expect(parseCapture("Pagar factura el 31 de febrero", TODAY).dateKey).toBeNull();
    expect(parseCapture("Pagar factura pasado mañana", TODAY).dateKey).toBe("2026-11-05");
  });

  it("el mismo día de la semana que hoy significa la próxima semana", () => {
    expect(parseCapture("Revisar reporte el martes", TODAY).dateKey).toBe("2026-11-10");
    expect(parseCapture("Revisar reporte el próximo lunes", TODAY).dateKey).toBe("2026-11-09");
  });

  it("repeticiones", () => {
    expect(parseCapture("Revisar inventario todos los lunes a las 9", TODAY)).toMatchObject({
      repeat: "weekly",
      dateKey: "2026-11-09",
      time: "09:00",
      title: "Revisar inventario",
    });
    expect(parseCapture("Revisar correos de lunes a viernes a las 9", TODAY)).toMatchObject({
      repeat: "weekdays",
      dateKey: TODAY,
    });
    expect(parseCapture("Respaldo diario", TODAY).repeat).toBe("daily");
    expect(parseCapture("Junta de resultados cada mes el 5 de diciembre", TODAY)).toMatchObject({
      repeat: "monthly",
      dateKey: "2026-12-05",
    });
    expect(parseCapture("Junta cada 2 semanas el lunes", TODAY)).toMatchObject({
      repeat: "biweekly",
      dateKey: "2026-11-09",
    });
  });

  it("frase sin fecha ni hora: solo título", () => {
    const r = parseCapture("comprar cinta canela", TODAY);
    expect(r).toMatchObject({ kind: "task", title: "Comprar cinta canela", dateKey: null, time: null });
  });

  it("importante y 'tengo una reunión'", () => {
    const r = parseCapture("Tengo una reunión con Dirección mañana a las 5 importante", TODAY);
    expect(r).toMatchObject({ kind: "meeting", time: "17:00", participants: ["Dirección"], important: true });
    expect(r.title).toBe("Reunión con Dirección");
  });
});

describe("captureFormHref", () => {
  it("arma la URL del formulario correcto", () => {
    expect(captureFormHref(parseCapture("Junta con Ana mañana a las 10", TODAY))).toBe(
      "/agenda/nueva?titulo=Junta+con+Ana&fecha=2026-11-04&hora=10%3A00&con=Ana",
    );
    expect(captureFormHref(parseCapture("Enviar cotización hoy urgente", TODAY))).toBe(
      "/tareas/nueva?titulo=Enviar+cotizaci%C3%B3n&fecha=2026-11-03&urgente=1",
    );
  });
});
