// Configuración
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyE7rIvtNpnUKYJScuHlMwmeRZyR1xJC9bujgkG7khLoz1gtE1m5zb-fn3OO7l6ePycxA/exec";

let registrosActuales = [];
let dniActual = "";

// Formatear DNI mientras escribe
document.getElementById("dniInput").addEventListener("input", function (e) {
  let value = e.target.value.replace(/[^0-9]/g, "");

  if (value.length > 4 && value.length <= 8) {
    value = value.substring(0, 4) + "-" + value.substring(4);
  } else if (value.length > 8) {
    value =
      value.substring(0, 4) +
      "-" +
      value.substring(4, 8) +
      "-" +
      value.substring(8, 13);
  }

  e.target.value = value;
});

// Buscar con Enter
document.getElementById("dniInput").addEventListener("keypress", function (e) {
  if (e.key === "Enter") buscarRegistros();
});

// Mostrar mensaje
function mostrarMensaje(texto, tipo = "info") {
  const msg = document.getElementById("mensaje");
  msg.textContent = texto;
  msg.className = "notice " + tipo;
  msg.classList.remove("hidden");

  setTimeout(() => msg.classList.add("hidden"), 6000);
}

// Mostrar/ocultar loading
function mostrarLoading(mostrar) {
  document.getElementById("loading").classList.toggle("hidden", !mostrar);
  document.getElementById("btnBuscar").disabled = mostrar;
}

// Buscar registros
async function buscarRegistros() {
  const dni = document.getElementById("dniInput").value.trim();

  if (!dni || dni.length < 15) {
    mostrarMensaje("Ingrese un DNI válido completo", "warning");
    return;
  }

  dniActual = dni;
  mostrarLoading(true);

  // Ocultar secciones
  document.getElementById("empleadoInfo").classList.add("hidden");
  document.getElementById("resultados").classList.add("hidden");
  document.getElementById("historial").classList.add("hidden");

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=obtenerRegistrosPendientes&dni=${encodeURIComponent(
      dni
    )}`;
    const response = await fetch(url);
    const data = await response.json();

    mostrarLoading(false);

    if (data.error) {
      mostrarMensaje(data.error, "error");
      return;
    }

    // Mostrar info del empleado
    if (data.empleado) {
      document.getElementById("empleadoNombre").textContent =
        data.empleado.nombre;
      document.getElementById("empleadoDNI").textContent = dni;
      document.getElementById("empleadoInfo").classList.remove("hidden");
    }

    // Mostrar registros
    if (!data.registros || data.registros.length === 0) {
      mostrarMensaje("No tiene registros pendientes de confirmación", "info");
    } else {
      registrosActuales = data.registros;
      renderizarTabla(registrosActuales);
      document.getElementById("resultados").classList.remove("hidden");
      mostrarMensaje(
        `Se encontraron ${registrosActuales.length} registro(s) pendientes`,
        "success"
      );
    }

    // Mostrar historial
    if (data.historial && data.historial.length > 0) {
      renderizarHistorial(data.historial);
      document.getElementById("historial").classList.remove("hidden");
    }
  } catch (error) {
    mostrarLoading(false);
    console.error("Error:", error);
    mostrarMensaje("Error al buscar registros: " + error.message, "error");
  }
}

// Renderizar tabla
function renderizarTabla(registros) {
  const tbody = document.getElementById("tablaBody");
  tbody.innerHTML = "";

  let totalHoras = 0;

  registros.forEach((reg, index) => {
    const horasReg = parseFloat(reg.totalHoras) || 0;
    totalHoras += horasReg;

    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td class="chk-col">
            <input type="checkbox" class="chkRegistro" data-index="${index}" data-fila="${
      reg.fila
    }" onchange="actualizarContador()">
          </td>
          <td>${formatearFecha(reg.fecha)}</td>
          <td>${reg.turno || "-"}</td>
          <td style="text-align:center; font-weight:600">${horasReg}</td>
          <td style="text-align:center">${reg.noct25 || 0}</td>
          <td style="text-align:center">${reg.diur25 || 0}</td>
          <td style="text-align:center">${reg.noct50 || 0}</td>
          <td style="text-align:center">${reg.prolong75 || 0}</td>
          <td style="text-align:center">${reg.feriado100 || 0}</td>
          <td>${reg.ingeniero || "-"}</td>
          <td style="font-size:12px">${reg.observaciones || "-"}</td>
        `;
    tbody.appendChild(tr);
  });

  document.getElementById("totalRegistros").textContent = registros.length;
  document.getElementById("totalHoras").textContent = totalHoras.toFixed(2);
  actualizarContador();
}

// Formatear fecha
function formatearFecha(fecha) {
  if (!fecha) return "-";
  const d = new Date(fecha);
  return d.toLocaleDateString("es-ES");
}

// Renderizar historial
function renderizarHistorial(historial) {
  const lista = document.getElementById("historialLista");
  lista.innerHTML = "";

  historial.forEach((item) => {
    const div = document.createElement("div");
    div.className = "history-item";
    const fecha = new Date(item.fecha);
    div.textContent = `📅 ${fecha.toLocaleDateString(
      "es-ES"
    )} - ${fecha.toLocaleTimeString("es-ES")} - ${item.cantidad} registro(s)`;
    lista.appendChild(div);
  });
}

// Seleccionar todos
function seleccionarTodos() {
  const checks = document.querySelectorAll(".chkRegistro");
  const todosSeleccionados = Array.from(checks).every((c) => c.checked);
  checks.forEach((c) => (c.checked = !todosSeleccionados));
  actualizarContador();
}

// Actualizar contador de seleccionados
function actualizarContador() {
  const seleccionados = document.querySelectorAll(
    ".chkRegistro:checked"
  ).length;
  const btnConfirmar = document.getElementById("btnConfirmar");
  btnConfirmar.disabled = seleccionados === 0;
  btnConfirmar.textContent =
    seleccionados > 0
      ? `✅ Confirmar ${seleccionados} registro(s)`
      : "✅ Confirmar seleccionados";
}

// Confirmar seleccionados
async function confirmarSeleccionados() {
  const checksSeleccionados = document.querySelectorAll(".chkRegistro:checked");

  if (checksSeleccionados.length === 0) {
    mostrarMensaje("Seleccione al menos un registro", "warning");
    return;
  }

  const filas = [];
  checksSeleccionados.forEach((chk) => {
    filas.push(parseInt(chk.dataset.fila));
  });

  const confirmar = confirm(
    `¿Está seguro de confirmar ${filas.length} registro(s)?\n\n` +
      `Esta acción no se puede deshacer.`
  );

  if (!confirmar) return;

  document.getElementById("btnConfirmar").disabled = true;
  document.getElementById("btnConfirmar").textContent = "⏳ Confirmando...";

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=confirmarRegistros&dni=${encodeURIComponent(
      dniActual
    )}&filas=${encodeURIComponent(JSON.stringify(filas))}`;

    await fetch(url, {
      method: "GET",
      mode: "no-cors", // ← IMPORTANTE
    });

    // Con mode: 'no-cors' no podemos leer la respuesta
    // Esperamos un momento y asumimos éxito
    await new Promise((resolve) => setTimeout(resolve, 2000));

    mostrarMensaje(
      `✅ Confirmación enviada para ${filas.length} registro(s). Recargando...`,
      "success"
    );

    // Recargar datos para verificar
    setTimeout(() => buscarRegistros(), 1500);
  } catch (error) {
    console.error("Error:", error);
    mostrarMensaje("Error al confirmar: " + error.message, "error");
  } finally {
    document.getElementById("btnConfirmar").disabled = false;
    actualizarContador();
  }
}

// Limpiar todo
function limpiarTodo() {
  document.getElementById("dniInput").value = "";
  document.getElementById("empleadoInfo").classList.add("hidden");
  document.getElementById("resultados").classList.add("hidden");
  document.getElementById("historial").classList.add("hidden");
  document.getElementById("mensaje").classList.add("hidden");
  registrosActuales = [];
  dniActual = "";
}
