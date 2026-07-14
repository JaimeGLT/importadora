import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { ConfirmModal } from '@/components/ui'
import type { Marca } from '@/types'
import { notify } from '@/lib/notify'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { gql } from '@/lib/graphql'
import { MARCAS_QUERY, backendToMarca } from '@/lib/queries/marcas.queries'

export function MarcasPage() {
  const { user } = useAuth()
  const { isTokenReady } = useAuth()
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingMarca, setEditingMarca] = useState<Marca | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Marca | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isTokenReady) return
    setLoading(true)
    gql<{ marca: { nodes: { id: number; nombre: string }[] } }>(MARCAS_QUERY)
      .then((data) => setMarcas(data.marca.nodes.map(backendToMarca)))
      .catch(() => notify.error('Error al cargar marcas'))
      .finally(() => setLoading(false))
  }, [isTokenReady])

  const filtered = useMemo(() => {
    if (!search.trim()) return marcas
    return marcas.filter((m) =>
      m.nombre.toLowerCase().includes(search.toLowerCase())
    )
  }, [marcas, search])

  const handleOpenNew = () => {
    setEditingMarca(null)
    setFormNombre('')
    setFormOpen(true)
  }

  const handleOpenEdit = (m: Marca) => {
    setEditingMarca(m)
    setFormNombre(m.nombre)
    setFormOpen(true)
  }

  const handleSave = async () => {
    const nombre = formNombre.trim()
    if (!nombre) { notify.error('Ingresa un nombre'); return }
    setSaving(true)
    try {
      if (editingMarca) {
        await api.put(`/marca/${editingMarca.id}`, { nombre })
        setMarcas(prev => prev.map(m => m.id === editingMarca.id ? { ...m, nombre } : m))
        notify.success('Marca actualizada')
      } else {
        const res = await api.post<{ id: number; nombre: string }>('/marca', { nombre })
        setMarcas(prev => [...prev, backendToMarca({ id: res.id, nombre: res.nombre })].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        notify.success('Marca creada')
      }
      setFormOpen(false)
      setEditingMarca(null)
      setFormNombre('')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al guardar la marca')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/marca/${deleteTarget.id}`)
      setMarcas(prev => prev.filter(m => m.id !== deleteTarget.id))
      notify.success('Marca eliminada')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al eliminar la marca')
    } finally {
      setDeleteTarget(null)
    }
  }

  if (user?.rol !== 'admin') {
    return (
      <MainLayout>
        <div className="bg-[#F7F7F7] min-h-screen flex items-center justify-center">
          <div className="bg-white rounded-xl border border-[#D0CBC4] p-10 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#F5C9C0] border border-[#D45040] flex items-center justify-center">
              <i className="ti ti-lock text-[#8A1E12] text-xl" />
            </div>
            <p className="text-sm font-semibold text-[#2D2B2A]">Acceso restringido</p>
            <p className="text-xs text-[#7A7571]">No tienes permisos para esta sección</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        <PageTopBar section="Sistema" title="Marcas" />

        <div className="px-7 py-6 max-w-[1400px] mx-auto">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 bg-gradient-to-br from-[#780e18] to-[#D4A333] rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ boxShadow: '0 6px 18px rgba(120,14,24,0.28)' }}
              >
                <i className="ti ti-tag text-2xl" />
              </div>
              <div>
                <h2
                  className="font-semibold text-[30px] text-[#2D2B2A] leading-none"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Marcas
                </h2>
                <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                  Administración de marcas de productos
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenNew}
              className="px-[18px] py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold active:scale-95 transition-all shadow-sm w-full md:w-auto"
            >
              <i className="ti ti-plus text-base" />
              Nueva marca
            </button>
          </div>

          {/* Table container */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

            {/* Toolbar */}
            <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-3">
              <h3 className="text-[15px] font-semibold text-[#2D2B2A] flex items-center gap-2">
                Lista de marcas
                <span className="bg-[#F5E8D4] text-[#780e18] text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  {filtered.length}
                </span>
              </h3>
              <div className="flex items-center gap-2 bg-[#F5F0EB] border border-[#D0CBC4] rounded-lg px-3.5 w-full sm:w-auto sm:min-w-[250px] focus-within:border-[#780e18] transition-colors">
                <i className="ti ti-search text-[#7A7571] text-base shrink-0" />
                <input
                  className="flex-1 py-2 bg-transparent text-sm text-[#2D2B2A] placeholder:text-[#7A7571] outline-none border-none"
                  placeholder="Buscar por nombre…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table content */}
            {!isTokenReady || loading ? (
              <TableSkeleton />
            ) : marcas.length === 0 ? (
              <EmptyState onNew={handleOpenNew} />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-5">
                <i className="ti ti-search-off text-[#7A7571] text-3xl mb-3" />
                <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin resultados</p>
                <p className="text-xs text-[#7A7571]">No hay marcas que coincidan con "{search}"</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F5F0EB] border-b border-[#D0CBC4]">
                    <th className="px-5 py-[11px] text-left text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em]">Nombre</th>
                    <th className="px-5 py-[11px] text-right text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E5E2]">
                  {filtered.map((m, idx) => (
                    <tr key={m.id} className={`border-t border-[#E8E5E2] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF5EE]'} hover:bg-[#F5F0EB] transition-colors`}>
                      <td className="px-5 py-[14px] border-r border-[#E8E5E2]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#F5E8D4] flex items-center justify-center shrink-0">
                            <i className="ti ti-tag text-[#780e18] text-[13px]" />
                          </div>
                          <span className="font-semibold text-[13px] text-[#2D2B2A]">{m.nombre}</span>
                        </div>
                      </td>
                      <td className="px-5 py-[14px]">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            title="Editar"
                            className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all"
                          >
                            <i className="ti ti-edit text-[15px]" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(m)}
                            title="Eliminar"
                            className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#F5C9C0] hover:text-[#8A1E12] hover:border-[#D45040] transition-all"
                          >
                            <i className="ti ti-trash text-[15px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <FormDrawer
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingMarca(null); setFormNombre('') }}
        nombre={formNombre}
        setNombre={setFormNombre}
        onSave={handleSave}
        saving={saving}
        editing={!!editingMarca}
        editingNombre={editingMarca?.nombre}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar marca"
        message={`¿Eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </MainLayout>
  )
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-[#E8E5E2]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-[14px] animate-pulse">
          <div className="h-5 w-14 rounded-md bg-[#F5F0EB]" />
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-7 h-7 rounded-lg bg-[#EDE8E3] shrink-0" />
            <div className="h-3 w-40 rounded bg-[#F5F0EB]" />
          </div>
          <div className="flex gap-1.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#EDE8E3]" />
            <div className="w-8 h-8 rounded-[6px] bg-[#EDE8E3]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-12 h-12 rounded-xl bg-white border border-[#D0CBC4] flex items-center justify-center mb-4">
        <i className="ti ti-tag text-[#7A7571] text-xl" />
      </div>
      <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin marcas registradas</p>
      <p className="text-xs text-[#7A7571] max-w-xs mb-5">
        Crea tu primera marca para organizar tus productos
      </p>
      <button
        onClick={onNew}
        className="px-5 py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm"
      >
        <i className="ti ti-plus text-base" />
        Nueva marca
      </button>
    </div>
  )
}

function FormDrawer({
  open, onClose, nombre, setNombre, onSave, saving, editing, editingNombre,
}: {
  open: boolean
  onClose: () => void
  nombre: string
  setNombre: (v: string) => void
  onSave: () => void
  saving: boolean
  editing: boolean
  editingNombre?: string
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-200"
        style={{
          background: 'rgba(45,43,42,0.45)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={clsx(
          'fixed z-[60] bg-white flex flex-col',
          'bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl',
          'sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:max-h-none sm:w-[440px] sm:rounded-none',
          'border-t border-[#E8E5E2] sm:border-t-0 sm:border-l',
          open
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full',
          'transition-transform duration-[280ms]',
        )}
        style={{ boxShadow: '-24px 0 40px -20px rgba(30,27,46,0.18)' }}
      >
        {/* Accent stripe */}
        <div className="h-[3px] bg-gradient-to-r from-[#780e18] to-[#D4A333] shrink-0" />

        {/* Header */}
        <div className="px-6 pt-5 pb-[18px] border-b border-[#E8E5E2] flex items-center justify-between gap-3 shrink-0 bg-[#FBFAF7]">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-[#7A7571] font-semibold mb-1">
              {editing ? 'Editar marca' : 'Nueva marca'}
            </div>
            <h2
              className="text-[20px] font-semibold text-[#2D2B2A] leading-tight"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {editing ? (editingNombre ?? 'Editar') : 'Registrar marca'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F0EFEC] transition-colors shrink-0"
          >
            <i className="ti ti-x text-[20px]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#F7F7F7]">
          <label className="text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.1em] block mb-1.5">
            Nombre <span className="text-[#B23A2A]">*</span>
          </label>
          <input
            className="w-full bg-white border border-[#D0CBC4] rounded-lg px-3 py-2 text-[13px] text-[#2D2B2A] placeholder:text-[#7A7571] focus:outline-none focus:ring-2 focus:ring-[#780e18]/20 focus:border-[#780e18] transition-colors"
            placeholder="Ej: Bosch, NGK, Continental…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave() }}
            autoFocus={open}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8E5E2] flex justify-end gap-2.5 shrink-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#D0CBC4] text-[13px] text-[#4A4744] font-semibold hover:bg-[#F5F0EB] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-[13px] font-semibold transition-colors disabled:opacity-50 active:scale-95 flex items-center gap-1.5"
          >
            {saving && <i className="ti ti-loader-2 animate-spin text-[14px]" />}
            {editing ? 'Guardar cambios' : 'Crear marca'}
          </button>
        </div>
      </div>
    </>
  )
}
