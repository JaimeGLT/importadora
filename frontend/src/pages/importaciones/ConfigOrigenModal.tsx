import { useState } from 'react'
import { Modal, Button, Input, ConfirmModal } from '@/components/ui'
import { useImportacionesStore } from '@/stores/importacionesStore'
import type { OrigenConfig } from '@/types'
import { notify } from '@/lib/notify'

interface Props {
  open: boolean
  onClose: () => void
}

export function ConfigOrigenModal({ open, onClose }: Props) {
  const { origenes, addOrigen, updateOrigen, deleteOrigen } = useImportacionesStore()

  const [nombre, setNombre]   = useState('')
  const [dias, setDias]       = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<OrigenConfig | null>(null)

  const resetForm = () => { setNombre(''); setDias(''); setEditingId(null) }

  const handleEdit = (o: OrigenConfig) => {
    setEditingId(o.id)
    setNombre(o.nombre)
    setDias(String(o.tiempo_estimado_dias))
  }

  const handleSave = () => {
    const d = parseInt(dias, 10)
    if (!nombre.trim() || !d || d <= 0) {
      notify.error('Completa nombre y días válidos')
      return
    }
    if (editingId) {
      updateOrigen(editingId, { nombre: nombre.trim(), tiempo_estimado_dias: d })
      notify.success('Origen actualizado')
    } else {
      addOrigen({ id: crypto.randomUUID(), nombre: nombre.trim(), tiempo_estimado_dias: d })
      notify.success('Origen agregado')
    }
    resetForm()
  }

  const handleDelete = () => {
    if (!confirmDel) return
    deleteOrigen(confirmDel.id)
    notify.success('Origen eliminado')
    setConfirmDel(null)
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => { resetForm(); onClose() }}
        title="Tiempos estimados por origen"
        size="md"
      >
        {/* Lista de orígenes */}
        <div className="space-y-2 mb-5">
          {origenes.length === 0 && (
            <p className="text-[13px] text-steel-400 text-center py-4">Sin orígenes configurados</p>
          )}
          {origenes.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#F9FAFB', border: '1px solid #E8EDF3' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-steel-800">{o.nombre}</p>
                <p className="text-[11px] text-steel-400">{o.tiempo_estimado_dias} días estimados</p>
              </div>
              <button
                onClick={() => handleEdit(o)}
                className="p-1.5 rounded-lg text-steel-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                title="Editar"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDel(o)}
                className="p-1.5 rounded-lg text-steel-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Eliminar"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Formulario */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: editingId ? '#EEF2FF' : '#F9FAFB', border: `1px solid ${editingId ? '#C7D2FE' : '#E8EDF3'}` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-steel-400">
            {editingId ? 'Editando origen' : 'Nuevo origen'}
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="País / Origen"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej. China"
              />
            </div>
            <div className="w-28">
              <Input
                label="Días est."
                type="number"
                min="1"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                placeholder="45"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {editingId && (
              <Button variant="secondary" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
            )}
            <Button size="sm" onClick={handleSave}>
              {editingId ? 'Guardar cambios' : 'Agregar origen'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        title="Eliminar origen"
        message={`¿Eliminar "${confirmDel?.nombre}"?`}
      />
    </>
  )
}
