# API REST de Productos con pipeline CI/CD

API REST (Node.js + Express + SQLite) con pruebas automatizadas, imagen Docker
y despliegue automático en AWS EC2 mediante GitHub Actions.

## Arquitectura

```
Desarrollador --git push--> GitHub (rama main)
                               |
                               v
                     GitHub Actions (main.yml)
          1. test            Jest + Supertest, cobertura minima 70 %
          2. build-and-push  imagen Docker -> Docker Hub (:latest y :<sha>)
          3. deploy          SSH a EC2 -> docker pull + run (puerto 80)
                               |
                               v
                  AWS EC2 (Ubuntu + Docker)  <--  http://<IP_EC2>/api/...
```

- **Backend:** Node.js 22, Express 5, SQLite (better-sqlite3).
- **Pruebas:** Jest y Supertest, con umbral de cobertura del 70 %.
- **Contenedor:** Dockerfile multi-etapa sobre `node:22-slim`.
- **Registro:** Docker Hub.
- **Servidor:** AWS EC2 con Ubuntu Server y Docker.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/` | Mensaje de bienvenida |
| GET | `/api/products` | Lista todos los productos |
| GET | `/api/products/:id` | Obtiene un producto |
| POST | `/api/products` | Crea un producto (`name`, `price`, `stock`) |
| PUT | `/api/products/:id` | Actualiza un producto |
| DELETE | `/api/products/:id` | Elimina un producto |
| GET | `/api/products/count/total` | Cuenta los productos |
| GET | `/api/products/search/:name` | Busca por nombre |
| POST | `/api/products/clear` | Vacía la tabla |
| POST | `/api/products/backup` | Crea un respaldo de la base de datos |
| GET | `/api/products/health/check` | Estado del servicio |

Todas las respuestas usan el formato `{ "statusCode": 200, "data": ... }`.

## Comandos locales

```bash
npm install            # instalar dependencias
npm run dev            # servidor en desarrollo (http://localhost:3000)
npm start              # servidor normal
npm test               # pruebas
npm run test:coverage  # pruebas + reporte de cobertura (mínimo 70 %)
```

### Con Docker

```bash
docker build -t webapp:latest .
docker run -d -p 80:3000 -v webapp-data:/data --name webapp-container webapp:latest
```

La API queda en `http://localhost/api/products`.

## Configuración del pipeline

### 1. GitHub Secrets

En el repositorio: **Settings > Secrets and variables > Actions > New repository secret**.

| Secret | Contenido |
| --- | --- |
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | Personal Access Token de Docker Hub (permisos de lectura y escritura) |
| `EC2_HOST` | IP pública (o DNS) de la instancia EC2 |
| `EC2_USER` | Usuario SSH de la instancia (`ubuntu`) |
| `EC2_SSH_KEY` | Contenido completo del archivo `.pem` |

No se guarda ninguna contraseña, IP, token ni clave dentro del código.

### 2. Instancia EC2

- Ubuntu Server con Docker instalado.
- Security Group con entrada para el puerto **22** (SSH) y el puerto **80** (HTTP).
- El usuario `ubuntu` debe poder ejecutar `sudo docker`.

### 3. Flujo del pipeline

1. En `push` o `pull_request` hacia `main` se ejecutan las pruebas y se muestra la cobertura. Si falla una prueba o la cobertura baja de 70 %, el pipeline se detiene.
2. Solo en `push` a `main`: se construye la imagen y se publica como `:latest` y `:<hash del commit>`.
3. Solo en `push` a `main`: se conecta a la EC2 por SSH, descarga `:latest`, detiene el contenedor anterior y levanta el nuevo en el puerto 80. La base de datos se guarda en el volumen `webapp-data`, por lo que los datos se conservan entre despliegues.

## Estructura del proyecto

```
.github/workflows/main.yml   pipeline CI/CD
src/                         código de la API
tests/                       pruebas unitarias y de integración
Dockerfile                   imagen del contenedor
.dockerignore                archivos excluidos de la imagen
```