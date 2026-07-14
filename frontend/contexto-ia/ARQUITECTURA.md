# CLAUDE.md

## Stack
React 18 + TypeScript strict · Vite · Tailwind + clsx · React Router v6 · Zustand · Auth via cookies HttpOnly

## Estructura
src/: components/{layout,ui,modals} · contexts/ · hooks/ · lib/{api.ts,graphql.ts,queries/} · stores/ · pages/[dominio]/ · types/ · utils/

## Reglas absolutas — nunca violar

### HTTP
- Todo fetch pasa por `gql()` o `api` — nunca `fetch()` directo en componentes
- GraphQL → `src/lib/graphql.ts` · REST → `src/lib/api.ts`
- Siempre esperar `isTokenReady` del AuthContext antes de cualquier fetch
- El refresh de token es automático — nunca manejarlo en componentes

### GraphQL
- Queries siempre en `src/lib/queries/[dominio].queries.ts`, nunca inline
- Prefijo de dominio en mayúsculas: `PRODUCTOS_QUERY`, `VENTAS_QUERY`
- Combinar queries relacionadas en una sola — minimizar round trips

### TypeScript
- Nunca `any` — usar `unknown` si el tipo es incierto
- `interface` para objetos · `type` para uniones y aliases
- Tipos globales en `src/types/index.ts` (barrel export)

### Estado
- Zustand: un store por dominio · los stores no hacen fetch, solo almacenan estado
- AuthContext no se reemplaza por Zustand — conviven
- Nunca `localStorage`/`sessionStorage` para tokens o sesión

### UI
- Usar siempre componentes de `src/components/ui/` — nunca HTML crudo (`<button>`, `<input>` sueltos)
- Toda acción destructiva → `ConfirmModal` antes de ejecutar
- Toda operación async → `toast.success` o `toast.error` al finalizar
- Estados de carga: skeleton por página (`animate-pulse`) — nunca spinner global bloqueante
- Sin lógica de negocio en componentes UI

### Páginas
Orden fijo: (1) useAuth · (2) estado local · (3) fetch en useEffect con isTokenReady · (4) datos derivados con useMemo · (5) handlers · (6) render con MainLayout > PageContainer > PageHeader

### Diseño
El diseño debe ser super intuitivo, super amigable y minimalista.