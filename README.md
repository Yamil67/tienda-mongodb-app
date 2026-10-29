# Catálogo de productos — MongoDB + Express

App web con API REST y MongoDB (base `tienda_db`, colección `productos`) desplegada en una VM de Oracle Cloud (Ubuntu 22.04).

## Endpoints

| Método | Ruta                    | Descripción                  | Éxito | Error           |
|--------|-------------------------|------------------------------|-------|-----------------|
| GET    | /api/productos          | Lista todos los productos    | 200   | 500             |
| GET    | /api/productos/:sku     | Un producto por SKU          | 200   | 404             |
| POST   | /api/productos          | Crea un producto             | 201   | 400, 409        |
| PUT    | /api/productos/:sku     | Actualiza un producto        | 200   | 400, 404        |
| DELETE | /api/productos/:sku     | Elimina un producto          | 200   | 404             |

## Configuración

Las credenciales de MongoDB no están en el código: se leen del archivo `.env` (ver `.env.example`).

```
npm install
npm start
```
