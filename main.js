const API = "/api/productos";

const tbody = document.querySelector("#tabla tbody");
const mensaje = document.getElementById("mensaje");
const dlgForm = document.getElementById("dlg-form");
const dlgDetalle = document.getElementById("dlg-detalle");
const form = document.getElementById("form-producto");
const formTitulo = document.getElementById("form-titulo");
const formError = document.getElementById("form-error");
const detalleDatos = document.getElementById("detalle-datos");

const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

let productos = [];
let skuEnEdicion = null;
let temporizador;

// ---------- Utilidades ----------

function avisar(texto, esError = false) {
  mensaje.textContent = texto;
  mensaje.className = esError ? "error" : "ok";
  mensaje.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { mensaje.hidden = true; }, 5000);
}

function errorEnFormulario(texto) {
  formError.textContent = texto;
  formError.hidden = false;
}

// Llama a la API y devuelve el JSON; si la respuesta no es exitosa lanza un Error con el mensaje del servidor.
async function pedir(url, opciones) {
  const res = await fetch(url, opciones);
  let cuerpo = null;
  try { cuerpo = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (!res.ok) throw new Error((cuerpo && cuerpo.error) || `Error ${res.status}`);
  return cuerpo;
}

function celda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

function boton(texto, clase, alHacerClic) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = texto;
  b.className = clase;
  b.addEventListener("click", alHacerClic);
  return b;
}

// ---------- Tabla ----------

function crearFila(p) {
  const tr = document.createElement("tr");

  // El SKU es un enlace que abre el modal con el detalle de ese producto
  const tdSku = document.createElement("td");
  const enlace = document.createElement("a");
  enlace.href = "#";
  enlace.className = "sku-link";
  enlace.textContent = p.sku;
  enlace.addEventListener("click", (ev) => {
    ev.preventDefault();
    verDetalle(p.sku);
  });
  tdSku.appendChild(enlace);

  const tdAcciones = document.createElement("td");
  tdAcciones.className = "acciones-fila";
  tdAcciones.append(
    boton("Editar", "secundario", () => abrirFormulario(p)),
    boton("Eliminar", "peligro", () => eliminar(p))
  );

  tr.append(tdSku, celda(p.nombre), celda(p.categoria), celda(moneda.format(p.precio)), celda(String(p.stock)), tdAcciones);
  return tr;
}

async function cargar() {
  try {
    productos = await pedir(API);
  } catch (err) {
    avisar("No se pudo cargar la lista: " + err.message, true);
    return;
  }

  tbody.replaceChildren();
  if (productos.length === 0) {
    const tr = document.createElement("tr");
    const td = celda("No hay productos registrados.");
    td.colSpan = 6;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const p of productos) tbody.appendChild(crearFila(p));
}

// ---------- Modal de detalle ----------

function agregarDato(etiqueta, valor, comoCodigo = false) {
  const dt = document.createElement("dt");
  dt.textContent = etiqueta;
  const dd = document.createElement("dd");
  if (comoCodigo) {
    const pre = document.createElement("pre");
    pre.textContent = valor;
    dd.appendChild(pre);
  } else {
    dd.textContent = valor;
  }
  detalleDatos.append(dt, dd);
}

async function verDetalle(sku) {
  try {
    const p = await pedir(`${API}/${encodeURIComponent(sku)}`);
    detalleDatos.replaceChildren();
    agregarDato("SKU", p.sku);
    agregarDato("Nombre", p.nombre);
    agregarDato("Categoría", p.categoria);
    agregarDato("Precio", moneda.format(p.precio));
    agregarDato("Stock", String(p.stock));
    agregarDato("Atributos", JSON.stringify(p.atributos ?? {}, null, 2), true);
    dlgDetalle.showModal();
  } catch (err) {
    avisar("No se pudo abrir el detalle: " + err.message, true);
  }
}

// ---------- Formulario (crear / editar) ----------

function abrirFormulario(p = null) {
  form.reset();
  formError.hidden = true;
  skuEnEdicion = p ? p.sku : null;
  formTitulo.textContent = p ? `Editar producto ${p.sku}` : "Nuevo producto";

  // El SKU identifica al producto, por eso no se puede cambiar al editar
  form.elements.sku.disabled = Boolean(p);

  if (p) {
    form.elements.sku.value = p.sku;
    form.elements.nombre.value = p.nombre;
    form.elements.categoria.value = p.categoria;
    form.elements.precio.value = p.precio;
    form.elements.stock.value = p.stock;
    form.elements.atributos.value = JSON.stringify(p.atributos ?? {});
  }
  dlgForm.showModal();
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  formError.hidden = true;

  let atributos = {};
  const texto = form.elements.atributos.value.trim();
  if (texto) {
    try {
      atributos = JSON.parse(texto);
    } catch {
      return errorEnFormulario('Los atributos no son un JSON válido. Ejemplo: {"color":"Negro"}');
    }
    if (atributos === null || typeof atributos !== "object" || Array.isArray(atributos)) {
      return errorEnFormulario('Los atributos deben ser un objeto JSON. Ejemplo: {"color":"Negro"}');
    }
  }

  const datos = {
    nombre: form.elements.nombre.value.trim(),
    categoria: form.elements.categoria.value.trim(),
    precio: Number(form.elements.precio.value),
    stock: Number(form.elements.stock.value),
    atributos,
  };
  const cabeceras = { "Content-Type": "application/json" };

  try {
    if (skuEnEdicion) {
      await pedir(`${API}/${encodeURIComponent(skuEnEdicion)}`, {
        method: "PUT", headers: cabeceras, body: JSON.stringify(datos),
      });
      avisar("Producto actualizado correctamente.");
    } else {
      datos.sku = form.elements.sku.value.trim();
      await pedir(API, { method: "POST", headers: cabeceras, body: JSON.stringify(datos) });
      avisar("Producto creado correctamente.");
    }
    dlgForm.close();
    await cargar();
  } catch (err) {
    errorEnFormulario(err.message);
  }
});

// ---------- Eliminar ----------

async function eliminar(p) {
  if (!confirm(`¿Eliminar el producto ${p.sku} (${p.nombre})? Esta acción no se puede deshacer.`)) return;
  try {
    await pedir(`${API}/${encodeURIComponent(p.sku)}`, { method: "DELETE" });
    avisar("Producto eliminado correctamente.");
    await cargar();
  } catch (err) {
    avisar("No se pudo eliminar: " + err.message, true);
  }
}

// ---------- Eventos ----------

document.getElementById("btn-nuevo").addEventListener("click", () => abrirFormulario());
document.getElementById("btn-cancelar").addEventListener("click", () => dlgForm.close());
document.getElementById("btn-cerrar-detalle").addEventListener("click", () => dlgDetalle.close());
dlgDetalle.addEventListener("click", (ev) => { if (ev.target === dlgDetalle) dlgDetalle.close(); });

cargar();
