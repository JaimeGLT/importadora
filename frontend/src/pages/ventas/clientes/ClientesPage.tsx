import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { Button, Input, Modal, ConfirmModal } from '@/components/ui'
import { notify } from '@/lib/notify'
import { gql } from '@/lib/graphql'
import { api } from '@/lib/api'
import { CLIENTES_QUERY, backendToCliente, type ClienteAPI } from '@/lib/queries/clientes.queries'
import type { Cliente } from '@/types'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-[#D0CBC4] p-[18px] animate-pulse">
          <div className="flex items-start justify-between mb-[14px]">
            <div className="w-9 h-9 rounded-lg bg-[#F0EFEC]" />
            <div className="h-5 w-16 rounded-full bg-[#F0EFEC]" />
          </div>
          <div className="h-9 w-24 rounded bg-[#F0EFEC]" />
          <div className="h-3 w-20 rounded bg-[#E8E5E2] mt-2" />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-[#E8E5E2]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-3.5 animate-pulse">
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-40 rounded bg-[#E8E5E2]" />
          </div>
          <div className="h-2.5 w-20 rounded bg-[#F0EFEC]" />
          <div className="flex gap-1.5">
            {[0, 1].map(j => <div key={j} className="h-8 w-8 rounded-[6px] bg-[#F0EFEC]" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-12 h-12 rounded-lg bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
        <i className="ti ti-users text-[#7A7571] text-xl" />
      </div>
      <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin clientes</p>
      <p className="text-xs text-[#7A7571] font-medium max-w-xs mb-5">
        Agrega el primer cliente del sistema.
      </p>
      <button
        onClick={onNew}
        className="px-5 py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm">
        <i className="ti ti-plus text-base" />
        Nuevo cliente
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ClientesPage() {
  const { isTokenReady } = useAuth()

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [endCursor, setEndCursor] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString('es-BO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  }, [])

  const loadClientes = (cursor?: string | null) => {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    gql<{ clientes: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ClienteAPI[] } }>(
      CLIENTES_QUERY,
      { first: 25, after: cursor }
    )
      .then(res => {
        const { totalCount, pageInfo, nodes } = res.clientes
        setClientes(prev => cursor ? [...prev, ...nodes.map(backendToCliente)] : nodes.map(backendToCliente))
        setTotalCount(totalCount)
        setHasNextPage(pageInfo.hasNextPage)
        setEndCursor(pageInfo.endCursor)
      })
      .catch(() => notify.error('Error cargando clientes'))
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      // Búsqueda local de los resultados ya cargados
    }, 300)
  }

  useEffect(() => {
    if (!isTokenReady) return
    loadClientes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTokenReady])

  const filtered = useMemo(() => {
    if (!search.trim()) return clientes
    const q = search.toLowerCase()
    return clientes.filter(c =>
      c.nombre?.toLowerCase().includes(q) ||
      c.apellido.toLowerCase().includes(q) ||
      c.telefono?.includes(q)
    )
  }, [clientes, search])

  const kpi = useMemo(() => ({
    total: totalCount,
    conTelefono: clientes.filter(c => c.telefono?.trim()).length,
    busqueda: filtered.length,
  }), [clientes, totalCount, filtered.length])

  const openNew = () => { setEditingCliente(null); setFormOpen(true) }
  const openEdit = (c: Cliente) => { setEditingCliente(c); setFormOpen(true) }

  const handleSave = async (data: Omit<Cliente, 'id'>) => {
    try {
      if (editingCliente) {
        await api.put(`/Cliente/${editingCliente.id}`, data)
        notify.success('Cliente actualizado')
      } else {
        await api.post(`/Cliente`, data)
        notify.success('Cliente registrado')
      }
      setFormOpen(false)
      setEditingCliente(null)
      loadClientes()
    } catch (err) {
      notify.error((err as Error).message || 'Error al guardar cliente')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.delete(`/Cliente/${confirmDelete.id}`)
      notify.success('Cliente eliminado')
      setConfirmDelete(null)
      loadClientes()
    } catch {
      notify.error('Error al eliminar cliente')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        {/* ── TopBar ──────────────────────────────────────────────────────── */}
        <header className="bg-[#F7F7F7]/85 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full h-[62px] px-7 border-b border-[#E8E5E2]">
          <div className="flex items-center gap-2 text-sm text-[#7A7571]">
            <span>Operaciones</span>
            <span className="text-[10px] opacity-40">/</span>
            <span>Ventas</span>
            <span className="text-[10px] opacity-40">/</span>
            <strong className="text-[#2D2B2A] font-semibold">Clientes</strong>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex bg-white px-3.5 py-1.5 rounded-lg items-center gap-2 border border-[#D8D4D0]">
              <i className="ti ti-calendar text-[#7A7571] text-[15px]" />
              <span className="text-xs text-[#4A4744]">{dateStr}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="w-[34px] h-[34px] flex items-center justify-center rounded-full bg-white border border-[#D8D4D0] text-[#4A4744] hover:bg-[#F7F7F7] transition-colors relative"
                title="Notificaciones"
              >
                <i className="ti ti-bell text-[15px]" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#B23A2A]" />
              </button>
              <button
                className="w-[34px] h-[34px] flex items-center justify-center rounded-full bg-white border border-[#D8D4D0] text-[#4A4744] hover:bg-[#F7F7F7] transition-colors"
                title="Configuración"
              >
                <i className="ti ti-settings text-[15px]" />
              </button>
            </div>
          </div>
        </header>

        <div className="px-7 py-[26px] max-w-[1320px] mx-auto w-full">

          {/* ── Page Header ─────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Clientes
              </h2>
              <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                Gestión de clientes del sistema
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={openNew}
                className="px-[18px] py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold active:scale-95 transition-all shadow-sm"
              >
                <i className="ti ti-plus text-base" />
                Nuevo cliente
              </button>
            </div>
          </div>

          {/* ── Metrics Grid ─────────────────────────────────────────────── */}
          {loading ? <MetricsSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">

              {/* Total clientes */}
              <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#780e18] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#780e18] opacity-[0.08]" />
                <div className="flex items-start justify-between mb-[14px]">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
                    <i className="ti ti-users text-white text-[16px]" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                    <i className="ti ti-circle-check text-[10px]" />
                    sistema
                  </span>
                </div>
                <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {kpi.total.toLocaleString('es-BO')}
                </div>
                <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Total clientes</div>
              </div>

              {/* Con teléfono */}
              <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#3F7A52] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#3F7A52] opacity-[0.08]" />
                <div className="flex items-start justify-between mb-[14px]">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3F7A52] to-[#6BAF80] flex items-center justify-center shrink-0">
                    <i className="ti ti-phone text-white text-[16px]" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                    registrados
                  </span>
                </div>
                <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {kpi.conTelefono.toLocaleString('es-BO')}
                </div>
                <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Con teléfono</div>
              </div>

              {/* Mostrando */}
              <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#D4A333] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#D4A333] opacity-[0.12]" />
                <div className="flex items-start justify-between mb-[14px]">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D4A333] to-[#B4881C] flex items-center justify-center shrink-0">
                    <i className="ti ti-search text-[#2D2010] text-[16px]" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200]">
                    {search ? 'resultados' : 'del sistema'}
                  </span>
                </div>
                <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {kpi.busqueda.toLocaleString('es-BO')}
                </div>
                <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Mostrando</div>
              </div>

            </div>
          )}

          {/* ── Table Container ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

            {/* Toolbar */}
            <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-[17px] font-semibold text-[#2D2B2A] tracking-[-0.01em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Clientes
                </h3>
                <span className="bg-[#F4ECDB] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {totalCount > 0 ? totalCount : filtered.length}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#FBFBFA] border border-[#D8D4D0] rounded-lg px-3.5 w-full sm:w-auto sm:min-w-[280px] focus-within:border-[#780e18] transition-colors">
                <i className="ti ti-search text-[#7A7571] text-[13px] shrink-0" />
                <input
                  className="flex-1 py-2 bg-transparent text-[13px] text-[#2D2B2A] font-normal placeholder:text-[#7A7571] outline-none border-none"
                  placeholder="Buscar por nombre o teléfono…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table / skeleton / empty */}
            {loading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState onNew={openNew} />
            ) : (
              <>
                {/* ── Desktop table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                      <col style={{ width: 80 }} />
                      <col style={{ width: 220 }} />
                      <col style={{ width: 160 }} />
                      <col style={{ width: 120 }} />
                    </colgroup>
                    <thead className="bg-[#F5F0EB]">
                      <tr>
                        {['ID', 'Cliente', 'Teléfono', ''].map((h, i) => (
                          <th key={i} className="px-[22px] py-[11px] text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] text-left border-b border-[#D0CBC4]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(c => (
                        <tr key={c.id} className="border-t border-[#E8E5E2] hover:bg-[#FAF5EE] transition-colors">
                          <td className="px-[22px] py-3.5 text-[13px] text-[#7A7571] font-mono">#{c.id}</td>
                          <td className="px-[22px] py-3.5">
                            <div className="text-[14px] font-semibold text-[#2D2B2A] truncate">{c.nombre} {c.apellido}</div>
                            {c.correoElectronico && (
                              <div className="text-[11px] text-[#7A7571] truncate mt-0.5">{c.correoElectronico}</div>
                            )}
                          </td>
                          <td className="px-[22px] py-3.5 text-[13px] text-[#4A4744]">{c.telefono || '—'}</td>
                          <td className="px-[22px] py-3.5">
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => openEdit(c)} title="Editar"
                                className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all">
                                <i className="ti ti-edit text-[14px]" />
                              </button>
                              <button onClick={() => setConfirmDelete(c)} title="Eliminar"
                                className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#F5C9C0] hover:text-[#8A1E12] hover:border-[#B23A2A] transition-all">
                                <i className="ti ti-trash text-[14px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile cards ── */}
                <div className="md:hidden">
                  {filtered.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3.5 border-b border-[#E8E5E2] last:border-0">
                      <div>
                        <div className="text-[13px] font-semibold text-[#2D2B2A]">#{c.id} — {c.nombre} {c.apellido}</div>
                        <div className="text-[11px] text-[#7A7571] mt-0.5">{c.telefono || 'Sin teléfono'}</div>
                        {c.correoElectronico && <div className="text-[11px] text-[#7A7571] truncate">{c.correoElectronico}</div>}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(c)}
                          className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all">
                          <i className="ti ti-edit text-[14px]" />
                        </button>
                        <button onClick={() => setConfirmDelete(c)}
                          className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#F5C9C0] hover:text-[#8A1E12] hover:border-[#B23A2A] transition-all">
                          <i className="ti ti-trash text-[14px]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Footer */}
            {!loading && filtered.length > 0 && (
              <div className="px-[22px] py-[14px] bg-[#F5F0EB] border-t border-[#D0CBC4] flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[12.5px] text-[#7A7571]">
                  Mostrando {filtered.length} de {totalCount} clientes
                </span>
                <div className="flex items-center gap-3">
                  {hasNextPage && (
                    <button
                      onClick={() => loadClientes(endCursor)}
                      disabled={loadingMore}
                      className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-white border border-[#D8D4D0] text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? 'Cargando...' : 'Cargar más'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <ClienteFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingCliente(null) }}
        onSave={handleSave}
        cliente={editingCliente}
      />

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void handleDelete()}
        title="Eliminar cliente"
        message={`¿Eliminar a "${confirmDelete?.nombre} ${confirmDelete?.apellido}"? Esta acción no se puede deshacer.`}
        loading={deleting}
      />
    </MainLayout>
  )
}

// ─── Cliente form modal ────────────────────────────────────────────────────────

interface ClienteFormModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<Cliente, 'id'>) => void
  cliente: Cliente | null
}

export function ClienteFormModal({ open, onClose, onSave, cliente }: ClienteFormModalProps) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [apellido, setApellido] = useState(cliente?.apellido ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '')
  const [correoElectronico, setCorreoElectronico] = useState(cliente?.correoElectronico ?? '')

  useEffect(() => {
    if (open) {
      setNombre(cliente?.nombre ?? '')
      setApellido(cliente?.apellido ?? '')
      setTelefono(cliente?.telefono ?? '')
      setDireccion(cliente?.direccion ?? '')
      setCorreoElectronico(cliente?.correoElectronico ?? '')
    }
  }, [open, cliente])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { notify.error('Ingresa el nombre'); return }
    if (!apellido.trim()) { notify.error('Ingresa el apellido'); return }
    if (!telefono.trim()) { notify.error('Ingresa el teléfono'); return }
    onSave({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim() || undefined,
      correoElectronico: correoElectronico.trim() || undefined,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={cliente ? 'Editar cliente' : 'Nuevo cliente'}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Nombre *</label>
          <Input
            type="text"
            placeholder="Nombre del cliente"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            maxLength={100}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Apellido *</label>
          <Input
            type="text"
            placeholder="Apellido del cliente"
            value={apellido}
            onChange={e => setApellido(e.target.value)}
            maxLength={100}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Teléfono *</label>
          <Input
            type="text"
            placeholder="Número de teléfono"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            maxLength={20}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Dirección <span className="font-normal text-[#7A7571]">(opcional)</span></label>
          <Input
            type="text"
            placeholder="Dirección del cliente"
            value={direccion}
            onChange={e => setDireccion(e.target.value)}
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Correo electrónico <span className="font-normal text-[#7A7571]">(opcional)</span></label>
          <Input
            type="email"
            placeholder="correo@ejemplo.com"
            value={correoElectronico}
            onChange={e => setCorreoElectronico(e.target.value)}
            maxLength={150}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1">{cliente ? 'Actualizar' : 'Registrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
