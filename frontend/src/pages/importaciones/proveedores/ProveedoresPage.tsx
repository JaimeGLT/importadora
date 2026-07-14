import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import type { Proveedor, ImportacionSummary } from '@/types'
import { ProveedorFormModal } from './ProveedorFormModal'
import { CatalogoProveedorModal } from './CatalogoProveedorModal'
import { notify } from '@/lib/notify'
import { clsx } from 'clsx'
import { gql } from '@/lib/graphql'
import { api } from '@/lib/api'
import {
  backendToProveedor,
  backendToImportacionSimple,
  PROVEEDORES_LIST_QUERY,
  PROVEEDOR_IMPORTACIONES_QUERY,
  DtoProveedor,
} from '@/lib/queries/proveedores.queries'
import { useProveedoresStore } from '@/stores/proveedoresStore'

export function ProveedoresPage() {
  const { isTokenReady } = useAuth()

  const { proveedores, setProveedores, addProveedor: storeAdd, updateProveedor: storeUpdate, removeProveedor: storeRemove } = useProveedoresStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editingProv, setEditingProv] = useState<Proveedor | null>(null)
  const [historialProv, setHistorialProv] = useState<Proveedor | null>(null)
  const [historialImportaciones, setHistorialImportaciones] = useState<ImportacionSummary[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<'activo' | 'inactivo' | ''>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isTokenReady) return
    loadProveedores()
  }, [isTokenReady])

  const loadProveedores = () => {
    let cancelled = false
    setLoading(true)
    gql<{ proveedor: { nodes: { id: number; nombre: string; nota: string; canImportaciones: number; total: number; pais: string; moneda: string; terminos: string; nombre_Contacto: string; email: string; telefono: string; tiempoReposicion: number; sitioWeb: string; estado: boolean }[] } }>(PROVEEDORES_LIST_QUERY)
      .then((res) => {
        if (cancelled) return
        setProveedores(res.proveedor.nodes.map(backendToProveedor))
      })
      .catch(() => notify.error('Error cargando proveedores'))
      .finally(() => { if (!cancelled) setLoading(false) })
  }

  const loadHistorial = (proveedorId: string) => {
    setHistorialLoading(true)
    gql<{
      importacion: {
        nodes: {
          id: number
          codigo: string
          fecha: string
          cantProductos: number
          total: number
          estado: string
          id_Proveedor: number
          f_Internacional: number
          aduana_Arancel: number
          trasporte_Interno: number
          proveedor: { id: number; nombre: string; pais: string }
        }[]
      }
    }>(
      PROVEEDOR_IMPORTACIONES_QUERY,
      { id: Number(proveedorId) },
    )
      .then((res) => {
        setHistorialImportaciones(res.importacion.nodes.map(backendToImportacionSimple))
      })
      .catch(() => notify.error('Error cargando historial'))
      .finally(() => setHistorialLoading(false))
  }

  const handleSave = async (data: Omit<Proveedor, 'id' | 'creado_en' | 'actualizado_en'>) => {
    if (!validateProveedor(data)) return
    setSaving(true)
    try {
      const body: DtoProveedor = {
        nombre: data.nombre,
        pais: data.pais,
        moneda: data.moneda,
        terminos: data.terminos_pago,
        nombre_Contacto: data.contacto,
        email: data.email,
        telefono: data.telefono ?? '',
        tiempoReposicion: data.tiempo_reposicion_dias ?? 0,
        sitioWeb: data.sitio_web ?? '',
        estado: data.estado === 'activo',
        nota: data.notas ?? '',
      }

      if (editingProv) {
        await api.put(`/Proveedor/${editingProv.id}`, body)
        storeUpdate(editingProv.id, { ...data, actualizado_en: new Date().toISOString() })
        notify.success('Proveedor actualizado')
      } else {
        const res = await api.post<{ id: number }>('/Proveedor', body)
        const newId = res?.id ?? Date.now().toString()
        const ahora = new Date().toISOString()
        const nuevo: Proveedor = { ...data, id: String(newId), creado_en: ahora, actualizado_en: ahora }
        storeAdd(nuevo)
        notify.success('Proveedor registrado')
      }
      setFormOpen(false)
      setEditingProv(null)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : editingProv ? 'Error actualizando proveedor' : 'Error creando proveedor')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (prov: Proveedor) => {
    if (!confirm(`¿Eliminar proveedor "${prov.nombre}"?`)) return
    try {
      await api.delete(`/Proveedor/${prov.id}`)
      storeRemove(prov.id)
      notify.success('Proveedor eliminado')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error eliminando proveedor')
    }
  }

  const validateProveedor = (data: Omit<Proveedor, 'id' | 'creado_en' | 'actualizado_en'>): boolean => {
    if (!data.nombre.trim()) { notify.error('El nombre es requerido'); return false }
    if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
      notify.error('Email inválido')
      return false
    }
    return true
  }

  const filtered = useMemo(() => {
    return proveedores.filter((p) => {
      const matchSearch =
        !search ||
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (p.pais?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
        (p.contacto?.toLowerCase() ?? '').includes(search.toLowerCase())
      const matchEstado = !filterEstado || p.estado === filterEstado
      return matchSearch && matchEstado
    })
  }, [proveedores, search, filterEstado])

  const totalActivos = useMemo(
    () => proveedores.filter((p) => p.estado === 'activo').length,
    [proveedores],
  )

  const openEdit = (p: Proveedor) => { setEditingProv(p); setFormOpen(true) }
  const openNew  = () => { setEditingProv(null); setFormOpen(true) }

  const openHistorial = (p: Proveedor) => {
    setHistorialProv(p)
    loadHistorial(p.id)
  }

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        <PageTopBar section="Importaciones" title="Proveedores" />

        <div className="px-7 py-6 max-w-[1400px] mx-auto">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 bg-gradient-to-br from-[#780e18] to-[#D4A333] rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ boxShadow: '0 6px 18px rgba(120,14,24,0.28)' }}
              >
                <i className="ti ti-building-store text-2xl" />
              </div>
              <div>
                <h2
                  className="font-semibold text-[30px] text-[#2D2B2A] leading-none"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Proveedores
                </h2>
                <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                  Registro de proveedores internacionales
                </p>
              </div>
            </div>
            <button
              onClick={openNew}
              className="px-[18px] py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold active:scale-95 transition-all shadow-sm w-full md:w-auto"
            >
              <i className="ti ti-plus text-base" />
              Nuevo proveedor
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-[14px] mb-6">
            <KpiCard
              label="Proveedores activos"
              value={totalActivos}
              iconClass="ti ti-circle-check"
              badgeText="activos"
              badgeIcon="ti ti-circle-check"
              badgeBg="#B8DCCA"
              badgeColor="#1E5C38"
              loading={loading}
            />
            <KpiCard
              label="Total registrados"
              value={proveedores.length}
              iconClass="ti ti-building-store"
              badgeText="total"
              badgeIcon="ti ti-database"
              badgeBg="#EDE8E3"
              badgeColor="#4A4744"
              loading={loading}
            />
          </div>

          {/* Table container */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

            {/* Toolbar */}
            <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-3">
              <h3 className="text-[15px] font-semibold text-[#2D2B2A] flex items-center gap-2">
                Lista de proveedores
                <span className="bg-[#F5E8D4] text-[#780e18] text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  {filtered.length}
                </span>
              </h3>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-[#F5F0EB] border border-[#D0CBC4] rounded-lg px-3.5 w-full sm:min-w-[260px] focus-within:border-[#780e18] transition-colors">
                  <i className="ti ti-search text-[#7A7571] text-base shrink-0" />
                  <input
                    className="flex-1 py-2 bg-transparent text-sm text-[#2D2B2A] placeholder:text-[#7A7571] outline-none border-none"
                    placeholder="Nombre, país o contacto…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-1.5">
                  {([['', 'Todos'], ['activo', 'Activos'], ['inactivo', 'Inactivos']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setFilterEstado(val)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors',
                        filterEstado === val
                          ? 'bg-[#780e18] text-white border-[#780e18]'
                          : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:bg-[#F5F0EB]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            {!isTokenReady || loading ? (
              <ListSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState onNew={openNew} />
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden lg:block">
                  <div
                    className="grid items-center px-5 py-[11px] bg-[#F5F0EB] border-b border-[#D0CBC4]"
                    style={{ gridTemplateColumns: '1fr 110px 100px 140px 120px 88px', gap: '0 16px' }}
                  >
                    {['Proveedor', 'País', 'Moneda', 'Términos pago', 'Contacto', ''].map((h) => (
                      <span key={h} className="text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em]">{h}</span>
                    ))}
                  </div>
                  <div className="divide-y divide-[#E8E5E2]">
                    {filtered.map((p) => (
                      <ProveedorRow
                        key={p.id}
                        prov={p}
                        onEdit={() => openEdit(p)}
                        onDelete={() => handleDelete(p)}
                        onHistorial={() => openHistorial(p)}
                      />
                    ))}
                  </div>
                </div>

                {/* Mobile */}
                <div className="lg:hidden divide-y divide-[#E8E5E2]">
                  {filtered.map((p) => (
                    <ProveedorCard
                      key={p.id}
                      prov={p}
                      onEdit={() => openEdit(p)}
                      onDelete={() => handleDelete(p)}
                      onHistorial={() => openHistorial(p)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ProveedorFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingProv(null) }}
        onSave={handleSave}
        initial={editingProv}
        saving={saving}
      />

      {historialProv && (
        <CatalogoProveedorModal
          open={!!historialProv}
          onClose={() => setHistorialProv(null)}
          proveedor={historialProv}
          importaciones={historialImportaciones}
          loading={historialLoading}
        />
      )}
    </MainLayout>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface RowProps {
  prov: Proveedor
  onEdit: () => void
  onDelete: () => void
  onHistorial: () => void
}

function ProveedorRow({ prov, onEdit, onDelete, onHistorial }: RowProps) {
  const COL = '1fr 110px 100px 140px 120px 88px'
  return (
    <div
      className={clsx(
        'grid items-center px-5 py-[14px] hover:bg-[#FAF5EE] transition-colors',
        prov.estado === 'inactivo' && 'opacity-60',
      )}
      style={{ gridTemplateColumns: COL, gap: '0 16px' }}
    >
      <div className="min-w-0">
        <p className="font-semibold text-[13px] text-[#2D2B2A] truncate">{prov.nombre}</p>
        <p className="text-[11px] text-[#7A7571] mt-0.5 truncate">{prov.email}</p>
      </div>

      <p className="text-[12px] text-[#4A4744] truncate">{prov.pais}</p>

      <span className="inline-flex items-center gap-1 bg-[#F5E8D4] text-[#780e18] text-[11px] font-semibold px-2.5 py-0.5 rounded-full w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-[#780e18] shrink-0" />
        {prov.moneda}
      </span>

      <p className="text-[11px] text-[#4A4744] truncate">{prov.terminos_pago}</p>

      <p className="text-[11px] text-[#7A7571] truncate">{prov.contacto}</p>

      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={onHistorial}
          title="Ver historial"
          className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all"
        >
          <i className="ti ti-file-text text-[15px]" />
        </button>
        <button
          onClick={onEdit}
          title="Editar proveedor"
          className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all"
        >
          <i className="ti ti-edit text-[15px]" />
        </button>
        <button
          onClick={onDelete}
          title="Eliminar proveedor"
          className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#F5C9C0] hover:text-[#8A1E12] hover:border-[#D45040] transition-all"
        >
          <i className="ti ti-trash text-[15px]" />
        </button>
      </div>
    </div>
  )
}

function ProveedorCard({ prov, onEdit, onDelete, onHistorial }: RowProps) {
  return (
    <div
      className={clsx(
        'px-4 py-4 hover:bg-[#FAF5EE] transition-colors',
        prov.estado === 'inactivo' && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[13px] text-[#2D2B2A] truncate">{prov.nombre}</p>
          <p className="text-[11px] text-[#7A7571] mt-0.5">{prov.pais}</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 bg-[#F5E8D4] text-[#780e18] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[#780e18] shrink-0" />
          {prov.moneda}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        <span className="text-[11px] text-[#7A7571]">
          Pago: <span className="text-[#4A4744] font-medium">{prov.terminos_pago}</span>
        </span>
        <span className="text-[11px] text-[#7A7571]">
          Contacto: <span className="text-[#4A4744] font-medium">{prov.contacto}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#E8E5E2]">
        <button
          onClick={onHistorial}
          className="flex items-center gap-1.5 text-[12px] text-[#780e18] hover:text-[#5a0b12] font-semibold transition-colors"
        >
          <i className="ti ti-file-text text-[15px]" />
          Ver historial
        </button>
        <div className="flex-1" />
        <button
          onClick={onEdit}
          title="Editar"
          className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all"
        >
          <i className="ti ti-edit text-[15px]" />
        </button>
        <button
          onClick={onDelete}
          title="Eliminar"
          className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#F5C9C0] hover:text-[#8A1E12] hover:border-[#D45040] transition-all"
        >
          <i className="ti ti-trash text-[15px]" />
        </button>
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-12 h-12 rounded-xl bg-white border border-[#D0CBC4] flex items-center justify-center mb-4">
        <i className="ti ti-building-store text-[#7A7571] text-xl" />
      </div>
      <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin proveedores registrados</p>
      <p className="text-xs text-[#7A7571] max-w-xs mb-5">
        Agrega tu primer proveedor internacional
      </p>
      <button
        onClick={onNew}
        className="px-5 py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm"
      >
        <i className="ti ti-plus text-base" />
        Nuevo proveedor
      </button>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: number | string
  iconClass: string
  badgeText: string
  badgeIcon: string
  badgeBg: string
  badgeColor: string
  loading?: boolean
}

function KpiCard({ label, value, iconClass, badgeText, badgeIcon, badgeBg, badgeColor, loading }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#780e18] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#780e18] opacity-[0.08]" />
      <div className="flex items-start justify-between mb-[14px]">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
          <i className={`${iconClass} text-white text-[16px]`} />
        </div>
        {loading
          ? <div className="h-5 w-20 rounded-full bg-[#F0EFEC] animate-pulse" />
          : <span
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: badgeBg, color: badgeColor }}
            >
              <i className={`${badgeIcon} text-[10px]`} />
              {badgeText}
            </span>
        }
      </div>
      {loading ? (
        <>
          <div className="h-8 w-24 rounded bg-[#F0EFEC] animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-[#E8E5E2] animate-pulse mt-2" />
        </>
      ) : (
        <>
          <div
            className="font-semibold text-[32px] text-[#2D2B2A]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {typeof value === 'number' ? value.toLocaleString('es-BO') : value}
          </div>
          <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">
            {label}
          </div>
        </>
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-[#E8E5E2]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-[14px] animate-pulse">
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-36 rounded bg-[#F5F0EB]" />
            <div className="h-2.5 w-48 rounded bg-[#EDE8E3]" />
          </div>
          <div className="h-2.5 w-20 rounded bg-[#F5F0EB]" />
          <div className="h-5 w-16 rounded-full bg-[#F5F0EB]" />
          <div className="h-2.5 w-24 rounded bg-[#F5F0EB]" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map(j => <div key={j} className="h-8 w-8 rounded-[6px] bg-[#EDE8E3]" />)}
          </div>
        </div>
      ))}
    </div>
  )
}
