const express = require("express");

const SKU_RE = /^[A-Za-z0-9._-]{1,40}$/;

function esObjetoPlano(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function esTexto(v, max) {
  return typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
}

const REGLAS = {
  nombre: (v) => esTexto(v, 120),
  categoria: (v) => esTexto(v, 60),
  precio: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
  stock: (v) => Number.isInteger(v) && v >= 0,
  atributos: (v) => esObjetoPlano(v),
};

const MENSAJES = {
  nombre: "El nombre debe ser un texto de 1 a 120 caracteres",
  categoria: "La categoría debe ser un texto de 1 a 60 caracteres",
  precio: "El precio debe ser un número mayor o igual a 0",
  stock: "El stock debe ser un número entero mayor o igual a 0",
  atributos: "Los atributos deben ser un objeto JSON (por ejemplo {\"color\":\"Azul\"})",
};

// Valida el cuerpo de la petición. Al crear exige todos los campos; al actualizar,
// acepta cualquiera de ellos pero al menos uno.
function validar(body, { creando }) {
  if (!esObjetoPlano(body)) {
    return { error: "El cuerpo de la petición debe ser un objeto JSON" };
  }

  if (creando) {
    for (const campo of ["nombre", "categoria", "precio", "stock"]) {
      if (body[campo] === undefined) return { error: `Falta el campo obligatorio: ${campo}` };
    }
  }

  const datos = {};
  for (const campo of Object.keys(REGLAS)) {
    if (body[campo] === undefined) continue;
    if (!REGLAS[campo](body[campo])) return { error: MENSAJES[campo] };
    datos[campo] = typeof body[campo] === "string" ? body[campo].trim() : body[campo];
  }

  if (!creando && Object.keys(datos).length === 0) {
    return { error: "Envía al menos un campo para actualizar" };
  }
  if (creando && datos.atributos === undefined) datos.atributos = {};

  return { datos };
}

function crearRutas(productos) {
  const router = express.Router();
  const SIN_ID = { projection: { _id: 0 } };

  // READ: todos los productos
  router.get("/", async (req, res, next) => {
    try {
      const lista = await productos.find({}, SIN_ID).sort({ sku: 1 }).toArray();
      res.status(200).json(lista);
    } catch (err) {
      next(err);
    }
  });

  // READ: un producto por SKU
  router.get("/:sku", async (req, res, next) => {
    try {
      const producto = await productos.findOne({ sku: req.params.sku }, SIN_ID);
      if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
      res.status(200).json(producto);
    } catch (err) {
      next(err);
    }
  });

  // CREATE
  router.post("/", async (req, res, next) => {
    const { datos, error } = validar(req.body, { creando: true });
    if (error) return res.status(400).json({ error });

    const sku = req.body.sku;
    if (typeof sku !== "string" || !SKU_RE.test(sku)) {
      return res.status(400).json({
        error: "El sku es obligatorio: solo letras, números, punto, guion y guion bajo (máximo 40)",
      });
    }

    try {
      await productos.insertOne({ sku, ...datos });
      res.status(201).json({ mensaje: "Producto creado", producto: { sku, ...datos } });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: `Ya existe un producto con el sku ${sku}` });
      }
      next(err);
    }
  });

  // UPDATE
  router.put("/:sku", async (req, res, next) => {
    const { datos, error } = validar(req.body, { creando: false });
    if (error) return res.status(400).json({ error });

    try {
      const resultado = await productos.updateOne({ sku: req.params.sku }, { $set: datos });
      if (resultado.matchedCount === 0) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }
      res.status(200).json({ mensaje: "Producto actualizado" });
    } catch (err) {
      next(err);
    }
  });

  // DELETE
  router.delete("/:sku", async (req, res, next) => {
    try {
      const resultado = await productos.deleteOne({ sku: req.params.sku });
      if (resultado.deletedCount === 0) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }
      res.status(200).json({ mensaje: "Producto eliminado" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function crearApp(productos, carpetaPublica) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(carpetaPublica));

  app.use("/api/productos", crearRutas(productos));
  app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "El JSON enviado está mal formado" });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  });

  return app;
}

module.exports = { crearApp };
