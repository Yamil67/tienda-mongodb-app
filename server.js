const path = require("path");
const { MongoClient } = require("mongodb");
const { crearApp } = require("./api");

const { MONGO_USER, MONGO_PASS } = process.env;
const MONGO_HOST = process.env.MONGO_HOST || "127.0.0.1:27017";
const PORT = Number(process.env.PORT) || 3000;
const DB_NAME = "tienda_db";

if (!MONGO_USER || !MONGO_PASS) {
  console.error("Faltan MONGO_USER y MONGO_PASS. Revisa el archivo .env");
  process.exit(1);
}

const uri =
  `mongodb://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS)}` +
  `@${MONGO_HOST}/${DB_NAME}?authSource=${DB_NAME}`;

async function main() {
  const cliente = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await cliente.connect();

  const productos = cliente.db(DB_NAME).collection("productos");
  const app = crearApp(productos, path.join(__dirname, "public"));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Aplicación lista en el puerto ${PORT}`);
  });
}

main().catch((err) => {
  console.error("No se pudo iniciar la aplicación:", err.message);
  process.exit(1);
});
