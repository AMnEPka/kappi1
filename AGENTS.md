# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

- **Frontend**: React 19 + CRA/Craco, Node 20, port 3000 (`frontend/`)
- **Backend**: FastAPI + Python 3.12, port 8001 (`backend/`)
- **Database**: MongoDB 6.0, port 27017 (runs via Docker)
- Default credentials: `admin` / `admin123`

### Running services locally

1. **MongoDB**: `docker run -d --name ssh-runner-mongodb -p 27017:27017 -e MONGO_INITDB_DATABASE=ssh_runner_db mongo:6.0`
2. **Backend**: `cd backend && source .venv/bin/activate && MONGO_URL=mongodb://localhost:27017 DB_NAME=ssh_runner_db CORS_ORIGINS='*' PYTHONPATH=/workspace/backend ENCRYPTION_KEY='cI31yQgFFdM8KF-iIoQN6GHRmWp82tKU_aUogjhyOWo=' uvicorn server:app --host 0.0.0.0 --port 8001 --reload`
3. **Frontend**: `cd frontend && REACT_APP_BACKEND_URL=http://localhost:8001 PORT=3000 HOST=0.0.0.0 BROWSER=none npx craco start`

### Known gotchas

- **Node version**: Must use Node 20 (not 22). The project's `ajv` dependency conflicts with webpack's `schema-utils` on Node 22. Use `nvm use 20`.
- **Frontend dependency install**: Use `npm install --legacy-peer-deps --install-strategy=nested` (not `yarn install`). The `package.json` has yarn `resolutions` that force `ajv@8` globally, breaking `fork-ts-checker-webpack-plugin` which needs `ajv@6`. The `--install-strategy=nested` flag prevents the hoisting conflict. Alternatively `yarn install` would respect the resolutions field but causes the same ajv crash at runtime.
- **Frontend `REACT_APP_BACKEND_URL`**: Must be set to `http://localhost:8001` when running locally, otherwise API calls default to `/` (same origin as frontend on port 3000) and fail.
- **Docker Compose**: The `docker-compose.yml` build fails because `frontend/Dockerfile` uses `npm install` without `--legacy-peer-deps` (React 19 peer dep conflict). Use local dev setup instead.

### Lint

- **Backend**: `cd backend && source .venv/bin/activate && flake8 --max-line-length=120 --exclude=.venv .`
- **Frontend**: ESLint is integrated into the CRA/craco build process (no standalone eslint config file). Lint errors surface during `craco start` and `craco build`.

### Tests

- **Backend**: `cd backend && source .venv/bin/activate && MONGO_URL=mongodb://localhost:27017 DB_NAME=ssh_runner_db ENCRYPTION_KEY='...' python -m pytest --no-cov --timeout=30` (use `--no-cov` to skip coverage threshold enforcement; install `requirements-test.txt` alongside `requirements.txt`)
- **Frontend**: `cd frontend && CI=true npx craco test --watchAll=false` (single example test; has known msw/jsdom TextEncoder issue)
- **Backend test deps**: `mongomock` requires `setuptools<81` for `pkg_resources`.

### Build

- **Frontend**: `cd frontend && REACT_APP_BACKEND_URL=http://localhost:8001 npx craco build`
